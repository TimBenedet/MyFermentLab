import { useCallback, useEffect, useMemo, useState } from 'react';
import { DevicesView } from './components/DevicesView';
import { FermentationCard } from './components/FermentationCard';
import { FermentationDetail } from './components/FermentationDetail';
import { LibraryView } from './components/LibraryView';
import { ThemeToggle } from './components/ThemeToggle';
import { useFermentationFeed } from './hooks/useFermentationFeed';
import { useHeatControl } from './hooks/useHeatControl';
import { useHomeAssistantEntities } from './hooks/useHomeAssistantEntities';
import { useProductions } from './hooks/useProductions';
import { useTheme } from './hooks/useTheme';
import type { HeatTarget } from './hooks/useHeatControl';
import type { HeatLot } from './lib/control';
import { formatClockSeconds } from './lib/format';
import { liveReading, outletsOf, probeTemperatureOf, temperatureProbeOf } from './lib/production';
import { assess, worstStatus } from './lib/reading';
import { STATUS_STYLES } from './lib/status';
import { CHART_PALETTES } from './lib/theme';
import type { BatchId, Production, StatusLevel } from './types';

type View = 'home' | 'library' | 'devices';

/** Deux propositions de fiche produit, comparables sur le même ferment. */
type PanelVariant = 'v1' | 'v2';

interface TabStyle {
  readonly view: View;
  readonly label: string;
}

/** Classes littérales dans les deux branches : Tailwind doit les voir écrites. */
const TABS: readonly TabStyle[] = [
  { view: 'home', label: 'Accueil' },
  { view: 'library', label: 'Bibliothèque' },
  { view: 'devices', label: 'Devices' },
];

interface CounterStyle {
  readonly level: StatusLevel;
  readonly numberClass: string;
}

/** Classes littérales : aucune concaténation, Tailwind doit les voir. */
const COUNTERS: readonly CounterStyle[] = [
  { level: 'ok', numberClass: 'text-emerald-400' },
  { level: 'warn', numberClass: 'text-amber-400' },
  { level: 'alarm', numberClass: 'text-red-400' },
];

export default function App() {
  // Les productions vivent dans `localStorage`, le moteur n'en sait rien : on les lui
  // donne à chaque changement de liste, il aligne ses lots dessus.
  const productions = useProductions();
  const feed = useFermentationFeed(productions.productions);
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<View>('home');
  const [selectedId, setSelectedId] = useState<BatchId | null>(null);
  // La variante vit ici et non dans la vue produit : elle survit au retour à
  // l'accueil, sinon la comparaison entre les deux propositions est impossible.
  const [panelVariant, setPanelVariant] = useState<PanelVariant>('v1');

  // Le jeton Home Assistant est injecté par le proxy du serveur de dev : la lecture
  // n'est lancée que lorsqu'elle sert — la vue Devices ouverte, ou un lot qui suit une
  // sonde de température.
  const watchesProbe = productions.productions.some(
    (production) => temperatureProbeOf(production) !== null,
  );
  const homeAssistant = useHomeAssistantEntities(view === 'devices' || watchesProbe);

  const readings = useMemo(() => Object.values(feed.fermentations), [feed.fermentations]);
  // Index des lots par identifiant : la carte a besoin de la date de lancement pour
  // dire depuis quand le lot tourne, le moteur ne connaît que sa config figée.
  const productionById = useMemo(() => {
    const index = new Map<string, Production>();
    for (const production of productions.productions) index.set(production.id, production);
    return index;
  }, [productions.productions]);

  /*
   * Asservissement des prises. Seuls les lots qui en portent une entrent dans la
   * boucle : une recette sans prise ne commande rien, une recette sans sonde qui
   * répond ne chauffe pas (voir `decideHeat`). La consigne est celle du moteur, donc
   * celle qu'on peut changer depuis la fiche du lot.
   */
  const heatTargets = useMemo<HeatTarget[]>(
    () =>
      feed.productions.flatMap((reading) => {
        const production = productionById.get(reading.config.id);
        if (production === undefined) return [];
        const outlets = outletsOf(production);
        if (outlets.length === 0) return [];
        return [
          {
            batchId: production.id,
            temperature: probeTemperatureOf(production, homeAssistant.entities),
            setpoint: reading.config.setpoints.temperature,
            outlets: outlets.map((device) => device.entityId),
          },
        ];
      }),
    [feed.productions, homeAssistant.entities, productionById],
  );
  const heat = useHeatControl(heatTargets, homeAssistant.entities);

  /** Ce que l'asservissement commande, lot par lot : lu par la carte et par la fiche. */
  const heatLots = useMemo(() => {
    const lots = new Map<string, HeatLot>();
    for (const target of heatTargets) {
      const command = heat.commands.get(target.batchId);
      if (command === undefined) continue;
      lots.set(target.batchId, {
        command,
        outlets: target.outlets.length,
        temperature: target.temperature,
      });
    }
    return lots;
  }, [heat.commands, heatTargets]);

  /*
   * Un lot affiche la mesure de sa sonde quand elle répond : le relevé brut du moteur
   * — simulé — est corrigé ici, une fois pour toutes, pour que la carte de l'accueil et
   * la fiche du lot montrent le même chiffre. `feed.timestamp` change à chaque tick,
   * ce qui rafraîchit l'âge du lot et le nom de la sonde.
   */
  const running = useMemo(
    () =>
      feed.productions.map((reading) => {
        const production = productionById.get(reading.config.id);
        if (production === undefined) return reading;
        return liveReading(
          reading,
          production,
          homeAssistant.entities,
          feed.timestamp,
          heatLots.get(production.id) ?? null,
        );
      }),
    [feed.productions, feed.timestamp, heatLots, homeAssistant.entities, productionById],
  );
  // Un lot lancé depuis la bibliothèque se suit comme un ferment : même carte, même
  // fiche, mêmes graphes. C'est son identifiant qui le distingue.
  const batches = useMemo(() => [...readings, ...running], [readings, running]);

  // L'id peut survivre à un rechargement à chaud d'un ferment supprimé : on retombe
  // alors proprement sur la vue d'ensemble au lieu de lever une erreur.
  const selected =
    selectedId === null
      ? null
      : (batches.find((reading) => reading.config.id === selectedId) ?? null);
  // Le lot correspondant, quand c'est bien un lot et non un ferment du tableau de bord.
  const selectedProduction =
    productions.productions.find((production) => production.id === selectedId) ?? null;
  /*
   * La relecture manuelle de la sonde ne se propose que sur un lot qui en suit une : c'est
   * la seule mesure qui vienne de Home Assistant, le reste de la fiche est simulé. Un
   * ferment du tableau de bord n'a rien à relire, et sa page n'a pas de sonde à montrer.
   */
  const selectedHasProbe =
    selectedProduction !== null && temperatureProbeOf(selectedProduction) !== null;
  // Un seul <h1> par page : celui du ferment quand une vue produit est ouverte.
  const showDetail = view === 'home' && selected !== null;

  const counts = useMemo(() => {
    const tally: Record<StatusLevel, number> = { ok: 0, warn: 0, alarm: 0 };
    for (const reading of batches) tally[worstStatus(assess(reading))] += 1;
    return tally;
  }, [batches]);

  const handleOpen = useCallback((id: BatchId) => {
    setSelectedId(id);
    window.scrollTo({ top: 0 });
  }, []);

  const handleClose = useCallback(() => {
    setSelectedId(null);
  }, []);

  const handleToggleVariant = useCallback(() => {
    setPanelVariant((current) => (current === 'v1' ? 'v2' : 'v1'));
  }, []);

  const handleSelectView = useCallback((next: View) => {
    setView(next);
    setSelectedId(null);
    window.scrollTo({ top: 0 });
  }, []);

  const handleStopProduction = useCallback(() => {
    if (selectedProduction === null) return;
    // Arrêter un lot coupe ses prises : un tapis ne doit pas rester chaud tout seul.
    heat.release(selectedProduction.devices);
    productions.stop(selectedProduction.id);
    setSelectedId(null);
  }, [heat, productions, selectedProduction]);

  useEffect(() => {
    if (selected === null) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected]);

  return (
    <div className="flex min-h-[calc(100dvh*0.8)] flex-col bg-anthracite-950 lg:h-[calc(100dvh*0.8)] lg:flex-row lg:overflow-hidden">
      <aside className="flex shrink-0 flex-col gap-3 border-b border-anthracite-800 px-4 py-3 lg:h-full lg:w-52 lg:gap-6 lg:border-r lg:border-b-0 lg:px-3 lg:py-5">
        <div className="min-w-0">
          {showDetail ? (
            <p className="text-[15px] font-semibold leading-tight text-zinc-100">
              Monitoring fermentation
            </p>
          ) : (
            <h1 className="text-[15px] font-semibold leading-tight text-zinc-100">
              Monitoring fermentation
            </h1>
          )}
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Simulation locale · {readings.length} ferments
          </p>
        </div>

        <nav className="flex gap-1 lg:flex-col" aria-label="Vues">
          {TABS.map((tab) => (
            <button
              key={tab.view}
              type="button"
              onClick={() => handleSelectView(tab.view)}
              aria-current={view === tab.view ? 'page' : undefined}
              className={
                view === tab.view
                  ? 'rounded-lg bg-accent-500/15 px-3 py-2 text-left text-[13px] font-medium text-accent-300 transition-colors lg:w-full'
                  : 'rounded-lg px-3 py-2 text-left text-[13px] font-medium text-zinc-400 transition-colors hover:bg-anthracite-900 hover:text-zinc-200 lg:w-full'
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {view === 'home' ? (
          <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-stretch">
            {COUNTERS.map((counter) => (
              <span
                key={counter.level}
                className="inline-flex items-center gap-2 rounded-lg bg-anthracite-900 px-3 py-1.5 text-[11px] text-zinc-400 lg:w-full"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLES[counter.level].dotClass}`}
                  aria-hidden="true"
                />
                <span className={`font-medium tabular-nums ${counter.numberClass}`}>
                  {counts[counter.level]}
                </span>
                {STATUS_STYLES[counter.level].label}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 lg:mt-auto">
          <p className="text-[10px] text-zinc-600">
            rafraîchissement 2 s · acquisition {formatClockSeconds(feed.timestamp)}
          </p>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col px-3 py-3 sm:px-6 lg:overflow-hidden">
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-2.5">

        {view === 'devices' ? (
          <DevicesView
            entities={homeAssistant.entities}
            error={homeAssistant.error}
            onRefresh={homeAssistant.refresh}
          />
        ) : view === 'library' ? (
          <LibraryView productionStore={productions} />
        ) : selected !== null ? (
          <FermentationDetail
            reading={selected}
            onClose={handleClose}
            windowEnd={feed.timestamp}
            onSetpointChange={feed.setTemperatureSetpoint}
            palette={CHART_PALETTES[theme]}
            variant={panelVariant}
            onToggleVariant={handleToggleVariant}
            onStopProduction={selectedProduction === null ? undefined : handleStopProduction}
            heat={selectedProduction === null ? null : (heatLots.get(selectedProduction.id) ?? null)}
            onRefreshProbe={selectedHasProbe ? homeAssistant.refresh : undefined}
          />
        ) : (
          /* Les lots de la bibliothèque passent au-dessus des cinq ferments, dans leur
             propre grille : les cinq gardent ainsi leur géométrie, et le défilement
             interne — jamais la page — prend le relais au-delà de quatre lots. */
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
            {running.length === 0 ? null : (
              <section className="flex shrink-0 flex-col gap-2">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <h2 className="text-[13px] font-semibold text-zinc-200">En production</h2>
                  <p className="text-[11px] text-zinc-500">
                    {running.length} {running.length > 1 ? 'recettes lancées' : 'recette lancée'}{' '}
                    dont l’arrêt se commande depuis sa fiche
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {running.map((reading) => (
                    <FermentationCard
                      key={reading.config.id}
                      reading={reading}
                      onOpen={handleOpen}
                    />
                  ))}
                </div>
              </section>
            )}

            <main className="grid min-h-0 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {readings.map((reading) => (
                <FermentationCard
                  key={reading.config.id}
                  reading={reading}
                  onOpen={handleOpen}
                />
              ))}
            </main>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
