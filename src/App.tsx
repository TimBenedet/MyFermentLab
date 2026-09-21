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
import {
  LIBRARY_ALL,
  LIBRARY_LIST,
  readStoredPage,
  writeStoredPage,
} from './lib/page';
import type { LibraryFilter, LibraryScreen, View } from './lib/page';
import { liveReading, outletsOf, probeTemperatureOf, temperatureProbeOf } from './lib/production';
import {
  appendProbeSample,
  pruneProbeLog,
  readProbeLog,
  removeProbeLogEntry,
  writeProbeLog,
} from './lib/probeLog';
import { assess, worstStatus } from './lib/reading';
import { STATUS_STYLES } from './lib/status';
import { CHART_PALETTES } from './lib/theme';
import type { ThemeName } from './lib/theme';
import type { BatchId, Production, StatusLevel } from './types';

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

/**
 * Bandeau d'état : la cadence d'acquisition et la bascule de thème.
 *
 * Il vit dans la barre latérale sur écran large, et collé au bas de l'écran sur téléphone —
 * d'où ce composant, plutôt que deux copies du même bloc à tenir à jour de pair.
 */
interface StatusStripProps {
  readonly timestamp: number;
  readonly theme: ThemeName;
  readonly onToggleTheme: () => void;
  readonly className: string;
}

function StatusStrip({ timestamp, theme, onToggleTheme, className }: StatusStripProps) {
  return (
    <div className={className}>
      <p className="text-[10px] text-zinc-600">
        rafraîchissement 2 s · acquisition {formatClockSeconds(timestamp)}
      </p>
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
    </div>
  );
}

export default function App() {
  // Les productions vivent dans `localStorage`, le moteur n'en sait rien : on les lui
  // donne à chaque changement de liste, il aligne ses lots dessus.
  const productions = useProductions();
  const feed = useFermentationFeed(productions.productions);
  const { theme, toggleTheme } = useTheme();
  // Journal des mesures réelles, relu une fois : les courbes des lots qui suivent une
  // sonde en dépendent, et il survit au rechargement comme le reste du stockage.
  const [probeLog, setProbeLog] = useState(readProbeLog);
  // La page quittée est relue **une fois**, avant le premier rendu : recharger l'onglet ne
  // doit pas ramener à l'accueil quand on lisait une cuve — ni refermer la recette ouverte
  // dans la bibliothèque, qui a ses propres écrans. Une lecture par état donnerait quatre
  // objets distincts pour la même intention, d'où le `useState` unique qui porte la page.
  const [restoredPage] = useState(readStoredPage);
  const [view, setView] = useState<View>(restoredPage.view);
  const [selectedId, setSelectedId] = useState<BatchId | null>(restoredPage.selectedId);
  // L'écran de la bibliothèque et son filtre vivent ici, pas dans `LibraryView` : c'est
  // `App` qui écrit la page, et deux écrivains se marcheraient dessus au rechargement.
  const [libraryScreen, setLibraryScreen] = useState<LibraryScreen>(restoredPage.library);
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>(restoredPage.libraryFilter);
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

  /*
   * Journal des mesures réelles. À chaque relevé Home Assistant (toutes les 30 s),
   * chaque lot qui suit une sonde de température y dépose la mesure reçue : c'est
   * elle qui devient sa courbe, pas la simulation. On n'écrit que quand le journal
   * change — une température stable ne crée pas de point redondant.
   */
  useEffect(() => {
    if (homeAssistant.entities.length === 0) return;
    setProbeLog((current) => {
      const next = new Map(current);
      const now = Date.now();
      const activeIds = new Set(productions.productions.map((production) => production.id));
      let changed = pruneProbeLog(next, activeIds, now);
      for (const production of productions.productions) {
        const probe = temperatureProbeOf(production);
        if (probe === null) continue;
        const value = probeTemperatureOf(production, homeAssistant.entities);
        if (value === null) continue;
        if (appendProbeSample(next, production.id, now, value)) changed = true;
      }
      if (changed) writeProbeLog(next);
      return changed ? next : current;
    });
  }, [homeAssistant.entities, productions.productions]);

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
          probeLog,
        );
      }),
    [feed.productions, feed.timestamp, heatLots, homeAssistant.entities, productionById, probeLog],
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
   * Le bouton de relecture est présent sur toutes les fiches — y compris les cinq ferments,
   * dont la température est simulée. `probeLinked` dit s'il y a une mesure réelle à relire :
   * sans sonde, le clic n'envoie aucune requête et la fiche l'explique quelques secondes.
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

  /*
   * Changer d'onglet referme ce que l'onglet quitté détaillait : la fiche d'un ferment
   * comme la recette ouverte dans la bibliothèque, et le filtre du panneau avec elle.
   * Cliquer l'onglet déjà actif fait de même — c'est le retour de la vue.
   */
  const handleSelectView = useCallback((next: View) => {
    setView(next);
    setSelectedId(null);
    setLibraryScreen(LIBRARY_LIST);
    setLibraryFilter(LIBRARY_ALL);
    window.scrollTo({ top: 0 });
  }, []);

  const handleStopProduction = useCallback(() => {
    if (selectedProduction === null) return;
    // Arrêter un lot coupe ses prises : un tapis ne doit pas rester chaud tout seul.
    heat.release(selectedProduction.devices);
    // Le journal du lot n'a plus d'avenir : on le retire.
    setProbeLog((current) => {
      const next = new Map(current);
      const changed = removeProbeLogEntry(next, selectedProduction.id);
      if (changed) writeProbeLog(next);
      return changed ? next : current;
    });
    productions.stop(selectedProduction.id);
    setSelectedId(null);
  }, [heat, productions, selectedProduction]);

  /*
   * Changer la consigne sur la fiche la change dans le moteur **et** la persiste sur
   * le lot : sans cela, un rechargement la ramènerait à la consigne de la recette.
   */
  const handleSetpointChange = useCallback(
    (id: BatchId, value: number) => {
      feed.setTemperatureSetpoint(id, value);
      if (selectedProduction !== null && selectedProduction.id === id) {
        productions.setSetpoint(id, value);
      }
    },
    [feed.setTemperatureSetpoint, productions, selectedProduction],
  );

  useEffect(() => {
    if (selected === null) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected]);

  /*
   * La page se mémorise à chaque changement, d'où qu'il vienne. Un seul effet couvre tous
   * les endroits qui la déplacent — choix d'un onglet, ouverture d'une fiche ou d'une
   * recette, retour, Échap, arrêt d'un lot, filtre du panneau — là où un appel dans chacun
   * finirait par en oublier un.
   */
  useEffect(() => {
    writeStoredPage({
      view,
      selectedId,
      library: libraryScreen,
      libraryFilter,
    });
  }, [view, selectedId, libraryScreen, libraryFilter]);

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
                  ? 'rounded-lg bg-accent-500/15 px-3 py-2.5 text-left text-[13px] font-medium text-accent-300 transition-colors sm:py-2 lg:w-full'
                  : 'rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-zinc-400 transition-colors hover:bg-anthracite-900 hover:text-zinc-200 sm:py-2 lg:w-full'
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

        <StatusStrip
          className="hidden items-center justify-between gap-2 lg:mt-auto lg:flex"
          timestamp={feed.timestamp}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
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
          <LibraryView
            productionStore={productions}
            screen={libraryScreen}
            onScreenChange={setLibraryScreen}
            filter={libraryFilter}
            onFilterChange={setLibraryFilter}
          />
        ) : selected !== null ? (
          <FermentationDetail
            reading={selected}
            onClose={handleClose}
            windowEnd={feed.timestamp}
            onSetpointChange={handleSetpointChange}
            palette={CHART_PALETTES[theme]}
            variant={panelVariant}
            onToggleVariant={handleToggleVariant}
            onStopProduction={selectedProduction === null ? undefined : handleStopProduction}
            heat={selectedProduction === null ? null : (heatLots.get(selectedProduction.id) ?? null)}
            onRefreshProbe={homeAssistant.refresh}
            probeLinked={selectedHasProbe}
            fallbackSetpoint={selectedProduction?.setpoint ?? undefined}
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

      {/*
       * Sur téléphone, le bandeau d'état passe en bas : il colle au bas de la fenêtre
       * pendant qu'on fait défiler, et se pose à la fin de la page une fois arrivé. À
       * partir de `lg` il retrouve la barre latérale, où il ne prend pas de place.
       */}
      <StatusStrip
        className="sticky bottom-0 z-20 flex items-center justify-between gap-2 border-t border-anthracite-800 bg-anthracite-950 px-4 py-2 lg:hidden"
        timestamp={feed.timestamp}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    </div>
  );
}
