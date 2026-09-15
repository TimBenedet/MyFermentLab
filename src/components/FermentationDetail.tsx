import { useEffect, useState } from 'react';
import { FERMENTATION_BY_KIND } from '../config/fermentations';
import type { HeatLot } from '../lib/control';
import {
  formatClockSeconds,
  formatElapsed,
  formatMeasure,
  formatPercent,
  formatSigned,
} from '../lib/format';
import { assess, coversFullWindow, windowStartOf, worstStatus } from '../lib/reading';
import { HUMIDITY_NOMINAL_BAND, NOMINAL_BAND } from '../lib/status';
import type { ChartPalette } from '../lib/theme';
import type { BatchId, FermentReading } from '../types';
import { MetricChart } from './MetricChart';
import type { MetricKind } from './MetricChart';
import { MetricRow } from './MetricRow';
import { RegulationStatus } from './RegulationStatus';
import { SetpointControl } from './SetpointControl';
import { StatusDot } from './StatusDot';
import { VesselIllustration } from './VesselIllustration';

export interface FermentationDetailProps {
  readonly reading: FermentReading;
  readonly onClose: () => void;
  readonly windowEnd: number;
  readonly onSetpointChange: (id: BatchId, value: number) => void;
  /** Couleurs du thème courant, transmises aux graphes (voir `lib/theme.ts`). */
  readonly palette: ChartPalette;
  /** `v1` : fiche actuelle, sept blocs séparés par des filets.
   *  `v2` : fiche allégée — vignette au lieu d'une illustration pleine largeur,
   *  aucun filet, consigne fondue dans la liste, état de régulation sur une ligne. */
  readonly variant?: 'v1' | 'v2';
  readonly onToggleVariant?: () => void;
  /**
   * Production lancée depuis la bibliothèque (et non un ferment du tableau de
   * bord) : la fiche propose alors de l'arrêter.
   */
  readonly onStopProduction?: () => void;
  /**
   * Asservissement des prises d'un lot. Fourni, il remplace l'estimation de la boucle
   * simulée : ce n'est plus « ça monte donc on chauffe », mais l'ordre réellement
   * envoyé à Home Assistant.
   */
  readonly heat?: HeatLot | null;
  /**
   * Bouton « relire la sonde ». Fourni sur **toutes** les fiches : il ne coûte aucune
   * hauteur d'en-tête et sa place est la même partout.
   */
  readonly onRefreshProbe?: () => void;
  /**
   * Une sonde de température est liée et la lecture Home Assistant tourne pour cette
   * fiche. Faux sur un ferment du tableau de bord, qui n'a pas de sonde, et sur un lot
   * dont la recette n'en a pas lié : cliquer sur `↻` ne peut alors rien relire, et la
   * fiche le dit — un message rouge qui s'efface au bout de quelques secondes, plutôt
   * qu'un bouton grisé qui n'explique rien.
   */
  readonly probeLinked?: boolean;
}

const METRIC_BANDS: Record<MetricKind, number> = {
  temperature: NOMINAL_BAND,
  humidity: HUMIDITY_NOMINAL_BAND,
  density: 0,
};

const MIN_PADDING: Record<MetricKind, number> = {
  temperature: 0.25,
  humidity: 2,
  density: 0.0008,
};

const DECIMALS: Record<MetricKind, 1 | 2 | 3> = {
  temperature: 1,
  humidity: 1,
  density: 3,
};

/**
 * Durée d'affichage du message « aucune sonde liée », en millisecondes. Le clic sur `↻`
 * ne peut rien relire : plutôt qu'un bouton grisé qui n'explique rien, il le dit — puis
 * se taît. Assez long pour être lu, assez court pour ne pas encombrer l'en-tête.
 */
const PROBE_NOTICE_MS = 5000;

interface ChannelStats {
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly amplitude: number;
}

const EMPTY_STATS: ChannelStats = { min: 0, max: 0, mean: 0, amplitude: 0 };

function stats(values: readonly number[]): ChannelStats {
  if (values.length === 0) return EMPTY_STATS;
  let min = values[0];
  let max = values[0];
  let total = 0;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
    total += value;
  }
  return { min, max, mean: total / values.length, amplitude: max - min };
}

function numbers(values: readonly (number | null)[]): number[] {
  return values.filter((value): value is number => value !== null);
}

/** Vue pleine page d'un ferment : illustration, relevés puis graphes empilés. */
export function FermentationDetail({
  reading,
  onClose,
  windowEnd,
  onSetpointChange,
  palette,
  variant = 'v1',
  onToggleVariant,
  onStopProduction,
  heat,
  onRefreshProbe,
  probeLinked = false,
}: FermentationDetailProps) {
  /*
   * Le message « aucune sonde liée » vit ici et non dans `App` : il appartient au clic qui
   * vient d'être fait, et il doit s'effacer tout seul. Un compteur plutôt qu'un booléen,
   * sans quoi un second clic pendant l'affichage ne relancerait pas le compte à rebours.
   */
  const [probeNotice, setProbeNotice] = useState(0);

  useEffect(() => {
    if (probeNotice === 0) return undefined;
    const timerId = window.setTimeout(() => setProbeNotice(0), PROBE_NOTICE_MS);
    return () => window.clearTimeout(timerId);
  }, [probeNotice]);

  /** Relire la sonde, ou dire pourquoi il n'y a rien à relire. */
  const handleRefreshProbe = (): void => {
    if (probeLinked) {
      onRefreshProbe?.();
      return;
    }
    setProbeNotice((count) => count + 1);
  };

  const { config, current, history } = reading;
  const assessment = assess(reading);
  const status = worstStatus(assessment);
  const humiditySetpoint = config.setpoints.humidity;
  const gravity = config.gravity;

  const temperatureStats = stats(history.map((sample) => sample.temperature));
  const humidityStats = stats(numbers(history.map((sample) => sample.humidity)));
  const densityStats = stats(numbers(history.map((sample) => sample.density)));
  const showsHumidity = humiditySetpoint !== null && current.humidity !== null;
  const showsDensity = assessment.density !== null;
  /*
   * La fenêtre tracée n'est pas toujours de 24 h : un lot récent n'a que son âge à
   * montrer, et la page doit dire la même chose que l'axe des graphes.
   */
  const windowLabel = coversFullWindow(history, windowEnd)
    ? '24 h'
    : formatElapsed(windowEnd - windowStartOf(history, windowEnd));
  // Valeur d'origine de la consigne : celle du ferment de référence du type. Les cinq
  // ferments du tableau de bord sont leur propre référence ; un lot lancé depuis la
  // bibliothèque hérite donc de la consigne de son type.
  const defaultSetpoint = FERMENTATION_BY_KIND[config.kind].setpoints.temperature;

  const readings = (
    <>
      {showsHumidity ? (
        <>
          <MetricRow label="Humidité" toneClass="text-teal-300">
            {formatPercent(current.humidity ?? 0, 1)}
          </MetricRow>
          <MetricRow label="Consigne HR">{formatPercent(humiditySetpoint, 0)}</MetricRow>
          <MetricRow label="Écart HR">
            {assessment.humidityDelta === null
              ? '—'
              : `${formatSigned(assessment.humidityDelta, 1)} pts`}
          </MetricRow>
        </>
      ) : (
        <MetricRow label="Humidité">
          <span className="font-normal text-zinc-500">non instrumentée</span>
        </MetricRow>
      )}

      {showsDensity ? (
        <>
          <MetricRow label="Densité" toneClass="text-violet-300">
            {formatMeasure(assessment.density, 3)}
          </MetricRow>
          <MetricRow label="Atténuation">
            {assessment.attenuation === null ? '—' : formatPercent(assessment.attenuation, 1)}
          </MetricRow>
        </>
      ) : null}
    </>
  );

  /**
   * En `v2` la fiche ne redonne pas les relevés : chaque valeur va dans l'en-tête
   * de la courbe qu'elle décrit, et la moyenne/amplitude dans sa note. Un chiffre,
   * un seul endroit — celui où on le lit.
   */
  const compact = variant === 'v2';

  const charts = (
    <>
      <MetricChart
        title="Température"
        unit="°C"
        metric="temperature"
        data={history}
        target={config.setpoints.temperature}
        targetLabel={`consigne ${formatMeasure(config.setpoints.temperature, 1)} °C`}
        palette={palette}
        decimals={DECIMALS.temperature}
        minPadding={MIN_PADDING.temperature}
        bandHalfWidth={METRIC_BANDS.temperature}
        windowEnd={windowEnd}
        footnote={`${compact ? `moy ${formatMeasure(temperatureStats.mean, 1)} °C · amp ${formatMeasure(temperatureStats.amplitude, 1)} °C · ` : ''}min ${formatMeasure(temperatureStats.min, 1)} °C · max ${formatMeasure(temperatureStats.max, 1)} °C · écart ${formatSigned(assessment.temperatureDelta, 2)} °C`}
      />

      {humiditySetpoint !== null ? (
        <MetricChart
          title="Humidité relative"
          unit="%"
          metric="humidity"
          data={history}
          target={humiditySetpoint}
          targetLabel={`consigne ${formatPercent(humiditySetpoint, 0)}`}
          palette={palette}
          decimals={DECIMALS.humidity}
          minPadding={MIN_PADDING.humidity}
          bandHalfWidth={METRIC_BANDS.humidity}
          windowEnd={windowEnd}
          live={compact && current.humidity !== null ? formatPercent(current.humidity, 1) : undefined}
          footnote={`${compact ? `moy ${formatPercent(humidityStats.mean, 1)} · amp ${formatMeasure(humidityStats.amplitude, 0)} pts · ` : ''}min ${formatPercent(humidityStats.min, 0)} · max ${formatPercent(humidityStats.max, 0)} · écart ${assessment.humidityDelta === null ? '—' : `${formatSigned(assessment.humidityDelta, 1)} pts`}`}
        />
      ) : null}

      {gravity !== null && assessment.density !== null ? (
        <MetricChart
          title="Densité"
          unit=""
          metric="density"
          data={history}
          target={gravity.final}
          targetLabel={`FG ${formatMeasure(gravity.final, 3)}`}
          palette={palette}
          decimals={DECIMALS.density}
          minPadding={MIN_PADDING.density}
          bandHalfWidth={METRIC_BANDS.density}
          windowEnd={windowEnd}
          live={compact ? formatMeasure(assessment.density, 3) : undefined}
          footnote={`${compact ? `moy ${formatMeasure(densityStats.mean, 3)} · amp ${formatMeasure(densityStats.amplitude, 3)} · ` : ''}min ${formatMeasure(densityStats.min, 3)} · max ${formatMeasure(densityStats.max, 3)} · OG ${formatMeasure(gravity.original, 3)} → FG ${formatMeasure(gravity.final, 3)} · atténuation ${assessment.attenuation === null ? '—' : formatPercent(assessment.attenuation, 1)}`}
        />
      ) : null}
    </>
  );

  /** Chiffre de tête + écart. Vit avec la cuve qu'il décrit, plus dans l'en-tête. */
  const headline = (
    <span className="flex items-baseline gap-2">
      <span className="flex items-baseline gap-1">
        <span className="text-2xl font-medium leading-none tabular-nums text-zinc-100">
          {formatMeasure(current.temperature, 1)}
        </span>
        <span className="text-[11px] text-zinc-500">°C</span>
      </span>
      <span className="text-[12px] tabular-nums text-zinc-400">
        {formatSigned(assessment.temperatureDelta, 2)}
      </span>
    </span>
  );

  /**
   * Synthèse de la fenêtre glissante. Elle existait déjà, mais enterrée dans les
   * notes de 10 px sous chaque graphe : deux canaux au maximum, sinon la colonne
   * de gauche devient plus haute que les graphes et la page se met à défiler
   * à 1024 × 640.
   */
  /**
   * Synthèse de la fenêtre glissante, en tableau : trois lignes suffisent là où
   * quatre `MetricRow` en demandaient six. La colonne de gauche n'a que 566 px à
   * 1024 × 640, tout doit y tenir avec la commande et la régulation.
   * Moyenne et amplitude, jamais le min/max : celui-ci reste dans la note sous
   * chaque graphe, sinon les deux se répètent.
   */
  const column = showsHumidity
    ? { label: 'Humidité', mean: formatPercent(humidityStats.mean, 1), spread: `${formatMeasure(humidityStats.amplitude, 0)} pts` }
    : showsDensity
      ? { label: 'Densité', mean: formatMeasure(densityStats.mean, 3), spread: formatMeasure(densityStats.amplitude, 3) }
      : null;

  const summaryHeader = (
    <>
      <span className="text-[10px] text-zinc-500">Sur {windowLabel}</span>
      <span className="text-right text-[10px] text-zinc-500">Moyenne</span>
      <span className="text-right text-[10px] text-zinc-500">Amplitude</span>
    </>
  );

  const summaryRows = (
    <>
      <span className="text-[11px] text-zinc-400">Température</span>
      <span className="text-right text-[12px] font-medium tabular-nums text-zinc-300">
        {formatMeasure(temperatureStats.mean, 1)} °C
      </span>
      <span className="text-right text-[12px] font-medium tabular-nums text-zinc-300">
        {formatMeasure(temperatureStats.amplitude, 1)} °C
      </span>

      {column === null ? null : (
        <>
          <span className="text-[11px] text-zinc-400">{column.label}</span>
          <span className="text-right text-[12px] font-medium tabular-nums text-zinc-300">
            {column.mean}
          </span>
          <span className="text-right text-[12px] font-medium tabular-nums text-zinc-300">
            {column.spread}
          </span>
        </>
      )}
    </>
  );

  const summary = (
    <div className="grid grid-cols-[auto_1fr_1fr] items-baseline gap-x-3 border-t border-anthracite-800 pt-2.5">
      {summaryHeader}
      {summaryRows}
    </div>
  );

  /** Un seul endroit décide de l'état de la boucle : la fiche le lit trois fois. */
  const regulation = <RegulationStatus reading={reading} heat={heat} />;
  const regulationInline = <RegulationStatus reading={reading} variant="inline" heat={heat} />;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-anthracite-800 pb-2.5">
        <button
          type="button"
          onClick={onClose}
          title="Revenir à la vue d'ensemble (Échap)"
          className="w-fit shrink-0 rounded-lg border border-anthracite-700 px-3 py-2.5 text-[11px] text-zinc-300 transition-colors hover:border-accent-500/50 hover:text-zinc-100 focus-visible:border-accent-400 focus-visible:outline-none sm:py-1.5"
        >
          ← Ferments
        </button>
        <h1 className="text-lg font-semibold text-zinc-100">{config.name}</h1>
        <StatusDot status={status} />
        <p className="text-[11px] text-zinc-500">
          {config.context} · {windowLabel} glissantes · acquisition {formatClockSeconds(current.t)}
        </p>
        {/*
         * Le message du clic sans sonde. Transitoire, il ne pousse que lui-même : le groupe
         * `ml-auto` garde les boutons à droite, et la place libérée est reprise telle quelle.
         */}
        {probeNotice === 0 ? null : (
          <span
            role="status"
            className="shrink-0 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11px] leading-none text-red-400"
          >
            Aucune sonde liée · la température affichée est simulée
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Glyphe seul, et non « Rafraîchir la sonde » : mesuré, un libellé texte fait
              passer l'en-tête de deux à trois lignes à 1024 et 1280 px (+24 px pris sur
              la fiche), alors que ce bouton ne coûte rien. Le libellé vit dans l'infobulle. */}
          {onRefreshProbe === undefined ? null : (
            <button
              type="button"
              onClick={handleRefreshProbe}
              aria-label="Rafraîchir la sonde"
              title={
                probeLinked
                  ? 'Relire la sonde tout de suite, sans attendre les 30 s'
                  : 'Aucune sonde liée : il n’y a rien à relire.'
              }
              className="w-fit shrink-0 rounded-lg border border-anthracite-700 px-3 py-2.5 text-[12px] leading-none text-zinc-300 transition-colors hover:border-accent-500/50 hover:text-zinc-100 focus-visible:border-accent-400 focus-visible:outline-none sm:px-2.5 sm:py-1.5"
            >
              ↻
            </button>
          )}

          {onStopProduction === undefined ? null : (
            <button
              type="button"
              onClick={onStopProduction}
              title="Arrêter ce lot et le retirer de l'accueil"
              className="w-fit shrink-0 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-[11px] font-medium text-red-400 transition-colors hover:border-red-400 hover:bg-red-500/20 focus-visible:border-red-400 focus-visible:outline-none sm:py-1.5"
            >
              Arrêter la production
            </button>
          )}

          {onToggleVariant === undefined ? null : (
            <button
              type="button"
              onClick={onToggleVariant}
              aria-pressed={variant === 'v2'}
              title={
                variant === 'v2'
                  ? 'Revenir à la fiche actuelle'
                  : 'Passer à la fiche allégée (proposition)'
              }
              className={
                variant === 'v2'
                  ? 'w-fit shrink-0 rounded-lg border border-accent-500/50 bg-accent-500/15 px-3 py-2.5 text-[11px] font-medium text-accent-300 transition-colors hover:border-accent-400 focus-visible:border-accent-400 focus-visible:outline-none sm:py-1.5'
                  : 'w-fit shrink-0 rounded-lg border border-anthracite-700 px-3 py-2.5 text-[11px] text-zinc-300 transition-colors hover:border-accent-500/50 hover:text-zinc-100 focus-visible:border-accent-400 focus-visible:outline-none sm:py-1.5'
              }
            >
              V2
            </button>
          )}
        </div>
      </header>

      {variant === 'v2' ? (
        /* V2 — minimaliste. Plus de colonne du tout : la fiche tient sur un
           bandeau horizontal, sans encadré ni filet, et les graphes prennent
           toute la largeur disponible. Rien n'est retiré du contenu — c'est la
           présentation qui disparaît. Le bandeau se replie sur deux lignes quand
           la largeur manque, grâce à `flex-wrap`. */
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex shrink-0 flex-wrap items-center gap-x-7 gap-y-2.5">
            <div className="flex items-center gap-3">
              {config.vessel === null ? null : (
                <div className="aspect-[160/250] h-14 shrink-0">
                  <VesselIllustration vessel={config.vessel} />
                </div>
              )}
              {headline}
            </div>

            <div className="w-36">
              {regulationInline}
            </div>

            <div className="w-44">
              <SetpointControl
                value={config.setpoints.temperature}
                fallback={defaultSetpoint}
                onApply={(value: number) => onSetpointChange(config.id, value)}
                variant="bare"
              />
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">{charts}</div>
        </div>
      ) : (
      /* La rangée remplit la hauteur disponible et la colonne de gauche s'étire
          à la même hauteur : c'est ce qui aligne les deux bas de section **et**
          ce qui ne laisse aucun vide sous les graphes. Plafonner la rangée crée
          un trou en bas ; plafonner les graphes décale le bas des deux colonnes. */
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        {config.vessel !== null ? (
          <aside className="flex w-full shrink-0 flex-col justify-between gap-2.5 rounded-xl border border-anthracite-800 bg-anthracite-900 px-3.5 py-3 lg:w-56">
            {/* Rapport 160/250 = celui du viewBox : le dessin remplit la boîte,
                sans bandes vides que `preserveAspectRatio` laisserait. */}
            <div className="mx-auto aspect-[160/250] h-40">
              <VesselIllustration vessel={config.vessel} />
            </div>
            <p className="text-center text-[11px] text-zinc-400">{config.vessel.label}</p>
            <div className="flex justify-center border-t border-anthracite-800 pt-2.5">
              {headline}
            </div>
            <SetpointControl
              value={config.setpoints.temperature}
              fallback={defaultSetpoint}
              onApply={(value: number) => onSetpointChange(config.id, value)}
            />
            <div className="flex flex-col border-t border-anthracite-800 pt-2.5">{readings}</div>
            {regulation}
            {summary}
          </aside>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border border-anthracite-800 bg-anthracite-900 px-3.5 py-2.5">
            {headline}
            <SetpointControl
              value={config.setpoints.temperature}
              fallback={defaultSetpoint}
              onApply={(value: number) => onSetpointChange(config.id, value)}
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="grid flex-1 grid-cols-2 gap-x-6">{readings}</div>
              <div className="flex flex-col sm:w-56">{summary}</div>
            </div>
            {regulation}
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">{charts}</div>
      </div>
      )}
    </section>
  );
}
