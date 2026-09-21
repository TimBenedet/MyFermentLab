import { useEffect, useRef, useState } from 'react';
import {
  byDisplayName,
  displayName,
  isTrackedEntity,
  roleOf,
  ROLE_LABELS,
} from '../lib/homeassistant';
import type { HassEntity } from '../lib/homeassistant';
import type { RecipeDevice } from '../types';
import { MetricIcon } from './MetricIcon';

/**
 * Sélecteur d'appareils posé sur une fiche de **lot en cours** : il lie et délie des
 * sondes et des prises sans arrêter la production. Même menu que le formulaire de
 * recette, mais ici le lot vit déjà — ajouter une prise l'asservit aussitôt, ajouter
 * une sonde en fait la mesure affichée.
 */

interface DeviceCandidate {
  readonly entityId: string;
  readonly label: string;
  readonly missing: boolean;
}

export interface DevicePickerProps {
  /** Appareils suivis, tels que les lit Home Assistant. */
  readonly entities: readonly HassEntity[];
  /** Appareils actuellement liés au lot. */
  readonly devices: readonly RecipeDevice[];
  readonly onChange: (devices: readonly RecipeDevice[]) => void;
  /** Erreur de lecture Home Assistant, ou `null` si elle a réussi. */
  readonly entitiesError: string | null;
}

/** Ligne du menu — trois branches littérales, Tailwind doit les voir écrites. */
const ROW_ON =
  'flex w-full items-center gap-2 bg-accent-500/10 px-3 py-1.5 text-left text-[11px] font-medium text-accent-300 transition-colors hover:bg-accent-500/15 focus-visible:bg-accent-500/15 focus-visible:outline-none';

const ROW_OFF =
  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-300 transition-colors hover:bg-anthracite-850 focus-visible:bg-anthracite-850 focus-visible:outline-none';

const ROW_MISSING =
  'flex w-full items-center gap-2 bg-amber-500/10 px-3 py-1.5 text-left text-[11px] font-medium text-amber-400 transition-colors hover:bg-amber-500/15 focus-visible:bg-amber-500/15 focus-visible:outline-none';

export function DevicePicker({ entities, devices, onChange, entitiesError }: DevicePickerProps) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  /*
   * Le menu se ferme de deux façons : clic à côté, et Échap. Échap doit s'arrêter ici —
   * `App` l'écoute sur `window` pour fermer la vue produit, et fermer le menu fermerait
   * aussi la page.
   */
  useEffect(() => {
    if (!open) return undefined;
    const closeIfOutside = (event: Event): void => {
      const target = event.target;
      if (target instanceof Node && pickerRef.current?.contains(target) === true) return;
      setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('pointerdown', closeIfOutside);
    document.addEventListener('mousedown', closeIfOutside);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', closeIfOutside);
      document.removeEventListener('mousedown', closeIfOutside);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  const available = entities.filter(isTrackedEntity).sort(byDisplayName);
  const known = new Set(available.map((entity) => entity.entity_id));
  // Lié et absent de la liste (appareil retiré, renommé, Home Assistant muet) :
  // il reste affiché en ambre plutôt que de disparaître en silence.
  const candidates: readonly DeviceCandidate[] = [
    ...devices
      .filter((device) => !known.has(device.entityId))
      .map((device) => ({ entityId: device.entityId, label: device.label, missing: true })),
    ...available.map((entity) => ({
      entityId: entity.entity_id,
      label: displayName(entity),
      missing: false,
    })),
  ];
  /** Liste encore vide et aucune erreur : la lecture est en cours, pas terminée. */
  const reading = entities.length === 0 && entitiesError === null;

  const toggle = (candidate: DeviceCandidate): void => {
    const on = devices.some((device) => device.entityId === candidate.entityId);
    onChange(
      on
        ? devices.filter((device) => device.entityId !== candidate.entityId)
        : [...devices, { entityId: candidate.entityId, label: candidate.label }],
    );
  };

  return (
    <div ref={pickerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="production-device-picker"
        title="Lier ou délier sondes et prises"
        className="w-fit shrink-0 rounded-lg border border-anthracite-700 px-3 py-2.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-accent-500/50 hover:text-zinc-100 focus-visible:border-accent-400 focus-visible:outline-none sm:py-1.5"
      >
        Appareils
        <span className="ml-1.5 rounded-full bg-anthracite-800 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-400">
          {devices.length}
        </span>
      </button>

      {!open ? null : (
        <div
          id="production-device-picker"
          role="group"
          aria-label="Appareils disponibles"
          className="absolute right-0 top-full z-30 mt-1 flex max-h-56 w-64 flex-col overflow-y-auto rounded-xl border border-anthracite-700 bg-anthracite-900 py-1 shadow-xl shadow-black/30"
        >
          {candidates.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-zinc-600">
              {reading
                ? 'Chargement des appareils…'
                : entitiesError !== null
                  ? 'Liste indisponible : les appareils déjà liés sont conservés.'
                  : 'Aucun appareil dans la vue Devices.'}
            </p>
          ) : (
            candidates.map((candidate) => {
              const on = devices.some((device) => device.entityId === candidate.entityId);
              const role = roleOf(candidate.entityId);
              return (
                <button
                  key={candidate.entityId}
                  type="button"
                  onClick={() => toggle(candidate)}
                  aria-pressed={on}
                  aria-label={`${candidate.label}, ${role === null ? 'appareil' : ROLE_LABELS[role].toLowerCase()} — ${on ? 'délier' : 'lier'}`}
                  title={
                    candidate.missing
                      ? `${candidate.entityId} — introuvable dans Home Assistant`
                      : candidate.entityId
                  }
                  className={on ? (candidate.missing ? ROW_MISSING : ROW_ON) : ROW_OFF}
                >
                  <span aria-hidden="true" className="w-3 shrink-0 text-center">
                    {on ? '✓' : '+'}
                  </span>
                  {role === 'outlet' ? (
                    <MetricIcon kind="power" className="h-3 w-3 shrink-0" />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{candidate.label}</span>
                  <span className="shrink-0 text-[10px] text-zinc-600">
                    {role === null ? 'hors suivi' : ROLE_LABELS[role]}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
