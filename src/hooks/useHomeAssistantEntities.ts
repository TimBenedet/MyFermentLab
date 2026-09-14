import { useCallback, useEffect, useState } from 'react';
import { fetchEntities } from '../lib/homeassistant';
import type { HassEntity } from '../lib/homeassistant';

export interface HomeAssistantFeed {
  readonly entities: readonly HassEntity[];
  readonly error: string | null;
  readonly refresh: () => void;
}

const REFRESH_MS = 30_000;

/**
 * Charge les entités Home Assistant tant que la vue qui les affiche est ouverte.
 * Le rafraîchissement périodique s'arrête quand `enabled` repasse à faux.
 */
export function useHomeAssistantEntities(enabled: boolean): HomeAssistantFeed {
  const [entities, setEntities] = useState<readonly HassEntity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => {
    setNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();

    const load = async (): Promise<void> => {
      try {
        const next = await fetchEntities(controller.signal);
        setEntities(next);
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, REFRESH_MS);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [enabled, nonce]);

  return { entities, error, refresh };
}
