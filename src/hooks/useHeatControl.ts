import { useCallback, useEffect, useRef, useState } from 'react';
import { decideHeat } from '../lib/control';
import { callSwitchService, roleOf } from '../lib/homeassistant';
import type { HassEntity } from '../lib/homeassistant';
import type { HeatCommand } from '../lib/control';
import type { RecipeDevice } from '../types';

/** Ce qu'un lot demande à l'asservissement : une mesure, une consigne, des prises. */
export interface HeatTarget {
  readonly batchId: string;
  /** Mesure de la sonde, `null` si elle ne répond pas. */
  readonly temperature: number | null;
  readonly setpoint: number;
  readonly outlets: readonly string[];
}

/**
 * Délai avant de réaffirmer une commande que Home Assistant contredit — prise
 * basculée à la main, commande perdue. En deçà, on laisse la main : une action
 * manuelle ne doit pas être annulée dans la seconde.
 */
const REASSERT_MS = 30_000;

export interface HeatControl {
  /** Commande en cours par lot, pour l'affichage. */
  readonly commands: ReadonlyMap<string, HeatCommand>;
  /** Coupe les prises d'un lot — à appeler quand on arrête sa production. */
  readonly release: (devices: readonly RecipeDevice[]) => void;
}

function commandState(command: HeatCommand): 'on' | 'off' {
  return command === 'heat' ? 'on' : 'off';
}

/** État réel d'une prise, ou `null` si Home Assistant ne la connaît plus. */
function stateOf(entities: readonly HassEntity[], entityId: string): 'on' | 'off' | null {
  const entity = entities.find((candidate) => candidate.entity_id === entityId);
  if (entity === undefined) return null;
  if (entity.state === 'on') return 'on';
  if (entity.state === 'off') return 'off';
  return null;
}

function sameCommands(
  left: ReadonlyMap<string, HeatCommand>,
  right: ReadonlyMap<string, HeatCommand>,
): boolean {
  if (left.size !== right.size) return false;
  for (const [key, value] of left) {
    if (right.get(key) !== value) return false;
  }
  return true;
}

/**
 * Asservissement des prises : ce hook est le seul endroit du dashboard qui **écrit**
 * dans Home Assistant sans qu'on ait cliqué.
 *
 * Il n'écrit qu'à bon escient : une commande n'est envoyée que sur **transition**
 * (chaud ↔ repos), ou lorsque Home Assistant contredit la dernière commande depuis
 * `REASSERT_MS`. Sans cette mémoire, un tick de 2 s enverrait 1 800 ordres par heure.
 *
 * Le lot n'est armé que par ce qu'il porte : une sonde de température qui répond et
 * au moins une prise. Sans mesure, `decideHeat` rend « repos » et les prises sont
 * coupées.
 */
export function useHeatControl(
  targets: readonly HeatTarget[],
  entities: readonly HassEntity[],
): HeatControl {
  const [commands, setCommands] = useState<ReadonlyMap<string, HeatCommand>>(new Map());
  /** Dernière commande envoyée par prise : c'est elle qui évite les répétitions. */
  const sent = useRef(new Map<string, { readonly state: 'on' | 'off'; readonly at: number }>());
  const commandsRef = useRef<ReadonlyMap<string, HeatCommand>>(commands);

  useEffect(() => {
    /*
     * Aucune liste reçue : on ne sait rien de la sonde — ni qu'elle est muette, ni
     * qu'elle existe. On ne touche à rien et on n'écrit rien : sans réponse de Home
     * Assistant, la commande échouerait de toute façon, et couper « au cas où »
     * ferait claquer le relais à chaque démarrage pour rien.
     */
    if (entities.length === 0) return;

    const next = new Map<string, HeatCommand>();
    for (const target of targets) {
      const previous = commandsRef.current.get(target.batchId) ?? 'idle';
      next.set(target.batchId, decideHeat(target.temperature, target.setpoint, previous));
    }

    const now = Date.now();
    for (const target of targets) {
      const command = next.get(target.batchId);
      if (command === undefined) continue;
      const wanted = commandState(command);

      for (const entityId of target.outlets) {
        const record = sent.current.get(entityId);
        const live = stateOf(entities, entityId);

        // Première évaluation : une prise déjà dans l'état voulu est adoptée sans
        // écriture — allumer une prise allumée n'apprend rien à personne.
        if (record === undefined && live === wanted) {
          sent.current.set(entityId, { state: wanted, at: now });
          continue;
        }
        if (record?.state === wanted) {
          const contradicted = live !== null && live !== wanted && now - record.at > REASSERT_MS;
          if (!contradicted) continue;
        }

        sent.current.set(entityId, { state: wanted, at: now });
        void callSwitchService(entityId, wanted === 'on').catch(() => {
          /*
           * Refus ou réseau : on garde la trace de la commande. Home Assistant dira
           * l'état réel, et la réaffirmation la retentera dans `REASSERT_MS` — pas à
           * chaque tick de 2 s.
           */
        });
      }
    }

    // Les lots disparus sortent de la table : la commande d'un lot arrêté n'existe plus.
    if (!sameCommands(commandsRef.current, next)) {
      commandsRef.current = next;
      setCommands(next);
    }
  }, [entities, targets]);

  const release = useCallback((devices: readonly RecipeDevice[]) => {
    for (const device of devices) {
      if (roleOf(device.entityId) !== 'outlet') continue;
      sent.current.set(device.entityId, { state: 'off', at: Date.now() });
      void callSwitchService(device.entityId, false).catch(() => undefined);
    }
  }, []);

  return { commands, release };
}
