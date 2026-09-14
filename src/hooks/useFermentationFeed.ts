import { useCallback, useEffect, useRef, useState } from 'react';
import { FERMENTATIONS } from '../config/fermentations';
import { FermentationEngine, TICK_MS } from '../simulation/engine';
import type { BatchSpec } from '../simulation/engine';
import { configForProduction } from '../lib/production';
import type { BatchId, Feed, Production } from '../types';

/** Le flux de simulation, plus les commandes qu'on peut lui envoyer. */
export interface FermentationFeed extends Feed {
  readonly setTemperatureSetpoint: (id: BatchId, value: number) => void;
}

/**
 * Branche le moteur de simulation sur un intervalle de 2 s.
 * Le moteur vit dans une ref : un seul état mutable, en dehors de React.
 */
export function useFermentationFeed(
  productions: readonly Production[] = [],
): FermentationFeed {
  const engineRef = useRef<FermentationEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new FermentationEngine(FERMENTATIONS);
  }
  const engine = engineRef.current;

  const [feed, setFeed] = useState<Feed>(() => engine.snapshot());

  /*
   * Les productions vivent dans `localStorage`, pas dans le moteur : à chaque
   * changement de liste — et au premier rendu, un rechargement remet le moteur à
   * zéro — on lui réaffirme quels lots tournent. `syncBatches` est idempotent.
   */
  useEffect(() => {
    // La date de lancement part avec la config : le moteur en a besoin pour rendre à un
    // lot l'historique qu'il a vécu avant le rechargement.
    const specs: BatchSpec[] = productions.map((production) => ({
      config: configForProduction(production),
      startedAt: production.startedAt,
    }));
    engine.syncBatches(specs);
    setFeed(engine.snapshot());
  }, [engine, productions]);

  useEffect(() => {
    const tick = (): void => {
      engine.advance(Date.now());
      setFeed(engine.snapshot());
    };
    const intervalId = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(intervalId);
  }, [engine]);

  // Remontée immédiate : sans ce snapshot, une consigne validée ne se verrait
  // qu'au tick suivant, jusqu'à 2 s plus tard.
  const setTemperatureSetpoint = useCallback(
    (id: BatchId, value: number): void => {
      engine.setTemperatureSetpoint(id, value);
      setFeed(engine.snapshot());
    },
    [engine],
  );

  return { ...feed, setTemperatureSetpoint };
}
