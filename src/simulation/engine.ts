import type {
  BatchId,
  ChannelDynamics,
  FermentConfig,
  FermentId,
  FermentReading,
  Feed,
  Sample,
} from '../types';
import { clamp, gaussian, mulberry32 } from '../lib/random';

export const TICK_MS = 2_000; // rafraîchissement de l'affichage
export const HISTORY_STEP_MS = 30_000; // pas d'archivage
export const HISTORY_WINDOW_MS = 86_400_000;

const REVERSION_TAU_SEC = 780; // rappel vers la consigne
const DRIFT_PERIOD_SEC = 3_420; // cycle lent ~57 min
const RIPPLE_PERIOD_SEC = 1_680; // ondulation ~28 min
const BURST_HALF_LIFE_SEC = 420; // relaxation des perturbations
const BURST_MIN_GAP_MS = 30 * 60_000; // perturbation toutes les 30 à 95 min
const BURST_MAX_GAP_MS = 95 * 60_000;
const BURST_GAP_SPAN_MS = BURST_MAX_GAP_MS - BURST_MIN_GAP_MS;
const MAX_SUB_STEP_SEC = 2; // subdivision si l'onglet a été inactif
const INITIAL_SPREAD_TEMPERATURE = 0.35;
const INITIAL_SPREAD_HUMIDITY = 2.5;
const GRAVITY_TAU_HOURS = 46;
const GRAVITY_DRIFT = 0.0008;
const GRAVITY_RIPPLE = 0.0005;

const TWO_PI = Math.PI * 2;
const MS_PER_SECOND = 1_000;
const MS_PER_HOUR = 3_600_000;
const HALF_LIFE = Math.LN2;

/** Base de simulation quand un lot n'a pas de consigne : la cible n'est pas affichée. */
const UNTARGETED_TEMPERATURE = 20;

/**
 * Canal de mesure : processus d'Ornstein-Uhlenbeck autour d'une consigne,
 * avec cycle de régulation lent, ondulation plus courte et perturbations
 * ponctuelles qui relaxent vers zéro.
 */
class MeasurementChannel {
  private readonly dynamics: ChannelDynamics;
  private setpoint: number;
  private readonly random: () => number;
  private value: number;
  private driftPhase: number;
  private ripplePhase: number;
  private burst: number;
  private nextBurstAt: number;

  constructor(
    dynamics: ChannelDynamics,
    setpoint: number,
    random: () => number,
    initialSpread: number,
    startMs: number,
  ) {
    this.dynamics = dynamics;
    this.setpoint = setpoint;
    this.random = random;
    this.value = setpoint + (random() < 0.5 ? -1 : 1) * initialSpread * random();
    this.driftPhase = random() * TWO_PI;
    this.ripplePhase = random() * TWO_PI;
    this.burst = 0;
    this.nextBurstAt = startMs + this.burstGap();
  }

  get current(): number {
    return this.value;
  }

  /**
   * Nouvelle consigne. La valeur mesurée ne saute pas : le rappel vers la cible
   * (constante de temps 780 s) l'y amène progressivement, comme une vraie cuve.
   */
  setSetpoint(setpoint: number): void {
    this.setpoint = setpoint;
  }

  private burstGap(): number {
    return BURST_MIN_GAP_MS + this.random() * BURST_GAP_SPAN_MS;
  }

  step(dt: number, nowMs: number): void {
    this.driftPhase = (this.driftPhase + (TWO_PI * dt) / DRIFT_PERIOD_SEC) % TWO_PI;
    this.ripplePhase = (this.ripplePhase + (TWO_PI * dt) / RIPPLE_PERIOD_SEC) % TWO_PI;

    const cycle =
      this.dynamics.cycleAmplitude *
      (0.78 * Math.sin(this.driftPhase) + 0.22 * Math.sin(this.ripplePhase));

    if (nowMs >= this.nextBurstAt) {
      const sign = this.random() < 0.5 ? -1 : 1;
      this.burst = sign * this.dynamics.burstScale * (0.35 + 0.75 * this.random());
      this.nextBurstAt = nowMs + this.burstGap();
    }
    this.burst *= Math.exp((-HALF_LIFE * dt) / BURST_HALF_LIFE_SEC);

    const effectiveTarget = this.setpoint + cycle + this.burst;
    this.value +=
      ((effectiveTarget - this.value) * dt) / REVERSION_TAU_SEC +
      clamp(gaussian(this.random), -3, 3) * this.dynamics.noise * Math.sqrt(dt);
  }
}

/** Un ferment en cours : ses canaux instrumentés, sa densité et son historique. */
class FermentState {
  /** Remplacé, jamais muté : la config reste un objet immuable pour React. */
  config: FermentConfig;
  readonly history: Sample[] = [];
  lastArchiveAt: number;

  private readonly temperature: MeasurementChannel;
  private readonly humidity: MeasurementChannel | null;
  private readonly pitchedAtMs: number;
  private readonly phase: number;

  constructor(config: FermentConfig, startMs: number) {
    this.config = config;
    this.lastArchiveAt = startMs;

    const random = mulberry32(config.seed);
    this.temperature = new MeasurementChannel(
      config.dynamics.temperature,
      config.setpoints.temperature ?? UNTARGETED_TEMPERATURE,
      random,
      INITIAL_SPREAD_TEMPERATURE,
      startMs,
    );

    const humidityDynamics = config.dynamics.humidity;
    const humiditySetpoint = config.setpoints.humidity;
    this.humidity =
      humidityDynamics !== null && humiditySetpoint !== null
        ? new MeasurementChannel(
            humidityDynamics,
            humiditySetpoint,
            random,
            INITIAL_SPREAD_HUMIDITY,
            startMs,
          )
        : null;

    this.phase = ((config.seed % 997) / 997) * TWO_PI;
    const elapsedHours = config.gravity?.elapsedHours ?? 0;
    this.pitchedAtMs = startMs - elapsedHours * MS_PER_HOUR;
  }

  advanceTo(dt: number, t: number): void {
    this.temperature.step(dt, t);
    this.humidity?.step(dt, t);
  }

  /**
   * Change la consigne de température : le canal de mesure **et** la config.
   * Sans la config, `assess()` continuerait de calculer l'écart et l'état contre
   * l'ancienne cible : la pastille resterait verte sur une cuve à 3 °C de sa
   * nouvelle consigne.
   */
  setTemperatureSetpoint(value: number): void {
    this.temperature.setSetpoint(value);
    this.config = {
      ...this.config,
      setpoints: { ...this.config.setpoints, temperature: value },
    };
  }

  sample(t: number): Sample {
    return {
      t,
      temperature: this.temperature.current,
      humidity: this.humidity?.current ?? null,
      density: this.densityAt(t),
    };
  }

  /**
   * Densité : fonction pure du temps (aucun état), donc l'historique archivé et
   * la valeur live ne peuvent pas diverger.
   */
  private densityAt(t: number): number | null {
    const gravity = this.config.gravity;
    if (gravity === null) return null;
    const elapsedHours = (t - this.pitchedAtMs) / MS_PER_HOUR;
    const absoluteHours = t / MS_PER_HOUR;
    const decay = Math.exp(-elapsedHours / GRAVITY_TAU_HOURS);
    const drift = GRAVITY_DRIFT * Math.sin((TWO_PI * absoluteHours) / 11 + this.phase);
    const ripple = GRAVITY_RIPPLE * Math.sin((TWO_PI * absoluteHours) / 3.5 + 2.7 * this.phase);
    return gravity.final + (gravity.original - gravity.final) * decay + drift + ripple;
  }
}

/**
 * Un lot à suivre : sa configuration, et la date à laquelle il a été lancé. C'est
 * cette date qui permet de lui reconstruire un historique après un rechargement.
 */
export interface BatchSpec {
  readonly config: FermentConfig;
  readonly startedAt: number;
}

/**
 * Moteur de simulation. Toute la mutation d'état est interne : React ne reçoit
 * que des objets immuables via `snapshot()`.
 */
export class FermentationEngine {
  /** Les cinq ferments du tableau de bord. */
  private readonly states: FermentState[];
  /**
   * Lots lancés depuis la bibliothèque, par identifiant. Leur historique est simulé
   * depuis leur **date de lancement** : un lot vit dans le stockage local, pas le
   * moteur, et un rechargement de page doit le retrouver avec son passé.
   */
  private readonly batches = new Map<BatchId, FermentState>();
  private lastAdvanceAt: number;

  constructor(configs: readonly FermentConfig[], nowMs: number = Date.now()) {
    this.lastAdvanceAt = nowMs;
    this.states = configs.map((config) => new FermentState(config, nowMs));
    this.reheat(this.states, nowMs - HISTORY_WINDOW_MS, nowMs);
  }

  /** Les cinq ferments, puis les lots. Un lot sans recette n'existe pas. */
  private allStates(): FermentState[] {
    return [...this.states, ...this.batches.values()];
  }

  /**
   * Aligne les lots du moteur sur la liste voulue : un lot absent démarre, un lot
   * disparu s'arrête, un lot connu reste intact — on ne lui refait pas son histoire à
   * chaque tick. Idempotent : l'appelant peut le rappeler quand la liste change.
   */
  syncBatches(specs: readonly BatchSpec[], nowMs: number = Date.now()): void {
    const until = Math.max(nowMs, this.lastAdvanceAt);
    const wanted = new Set(specs.map((spec) => spec.config.id));
    for (const id of [...this.batches.keys()]) {
      if (!wanted.has(id)) this.batches.delete(id);
    }
    for (const spec of specs) {
      if (this.batches.has(spec.config.id)) continue;
      // Le lot démarre à sa vraie date : un lot lancé il y a 55 min retrouve 55 min de
      // courbe, au lieu d'un point unique qui laissait le graphe vide.
      const startMs = Math.max(spec.startedAt, until - HISTORY_WINDOW_MS);
      const state = new FermentState(spec.config, startMs);
      this.reheat([state], startMs, until);
      this.batches.set(spec.config.id, state);
    }
  }

  /**
   * Historique rétroactif d'un ensemble de ferments, au pas d'archivage. Le passé
   * n'est pas deviné : il est simulé, à partir de la graine de la config.
   */
  private reheat(states: readonly FermentState[], fromMs: number, toMs: number): void {
    const dt = HISTORY_STEP_MS / MS_PER_SECOND;
    for (let t = fromMs; t <= toMs; t += HISTORY_STEP_MS) {
      for (const state of states) {
        state.advanceTo(dt, t);
        state.history.push(state.sample(t));
        state.lastArchiveAt = t;
      }
    }
  }

  /** Avance le moteur jusqu'à `nowMs`, en subdivisant si l'onglet est resté inactif. */
  advance(nowMs: number): void {
    const elapsedSec = Math.max((nowMs - this.lastAdvanceAt) / MS_PER_SECOND, 0);
    if (elapsedSec === 0) return;

    // Une seule liste pour tout le tick : la construire dans la boucle des sous-pas
    // allouerait un tableau par sous-pas.
    const states = this.allStates();
    const steps = Math.max(1, Math.ceil(elapsedSec / MAX_SUB_STEP_SEC));
    const dt = elapsedSec / steps;
    const fromMs = this.lastAdvanceAt;

    for (let step = 1; step <= steps; step += 1) {
      const t = fromMs + step * dt * MS_PER_SECOND;
      for (const state of states) {
        state.advanceTo(dt, t);
        this.archive(state, t);
      }
    }

    this.lastAdvanceAt = nowMs;
    for (const state of states) this.purge(state, nowMs);
  }

  private archive(state: FermentState, t: number): void {
    while (t - state.lastArchiveAt >= HISTORY_STEP_MS) {
      state.lastArchiveAt += HISTORY_STEP_MS;
      state.history.push(state.sample(state.lastArchiveAt));
    }
  }

  /** Fenêtre glissante : tout ce qui sort des 24 h est coupé, l'historique ne croît pas. */
  private purge(state: FermentState, nowMs: number): void {
    const cutoff = nowMs - HISTORY_WINDOW_MS;
    let index = 0;
    while (index < state.history.length && state.history[index].t < cutoff) index += 1;
    if (index > 0) state.history.splice(0, index);
  }

  /** Applique une nouvelle consigne de température à un ferment ou à un lot. */
  setTemperatureSetpoint(id: BatchId, value: number): void {
    const state = this.allStates().find((candidate) => candidate.config.id === id);
    state?.setTemperatureSetpoint(value);
  }

  snapshot(): Feed {
    // L'engine est toujours construit avec le jeu complet de ferments : la table
    // est donc complète, ce que TypeScript ne peut pas déduire d'un tableau.
    const fermentations = Object.fromEntries(
      this.states.map((state) => [state.config.id, this.readingOf(state)]),
    ) as Record<FermentId, FermentReading>;

    return {
      fermentations,
      productions: [...this.batches.values()].map((state) => this.readingOf(state)),
      timestamp: this.lastAdvanceAt,
    };
  }

  private readingOf(state: FermentState): FermentReading {
    const current = state.sample(this.lastAdvanceAt);
    // Toujours un nouveau tableau : sinon les useMemo des graphes ne se recalculent pas.
    const history = [...state.history];
    const lastArchivedAt = history.length > 0 ? history[history.length - 1].t : Number.NaN;
    if (lastArchivedAt !== current.t) history.push(current);
    return { config: state.config, current, history };
  }
}
