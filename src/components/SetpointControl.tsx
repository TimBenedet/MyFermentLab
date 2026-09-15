import { useEffect, useState } from 'react';
import { formatMeasure } from '../lib/format';

/** Bornes de sécurité : hors de cette plage, une fermentation n'a plus de sens. */
export const SETPOINT_MIN = 4;
export const SETPOINT_MAX = 45;
/** Pas des boutons + et −. La bande nominale fait 0,2 °C : 0,1 serait trop fin. */
export const SETPOINT_STEP = 0.5;

export interface SetpointControlProps {
  /** Consigne actuellement appliquée par le moteur. */
  readonly value: number;
  /** Consigne d'origine de `src/config/fermentations.ts`, pour le rétablissement. */
  readonly fallback: number;
  readonly onApply: (value: number) => void;
  /** `boxed` : bloc titré, champ encadré, bouton `Valider` toujours visible.
   *  `bare` : une ligne de la liste, boutons ronds nus, validation à la demande. */
  readonly variant?: 'boxed' | 'bare';
}

/** « 19,5 » ou « 19.5 » → 19.5. `null` si la saisie n'est pas un nombre. */
function parseDraft(draft: string): number | null {
  const normalized = draft.trim().replace(',', '.');
  if (normalized === '') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  return Math.min(SETPOINT_MAX, Math.max(SETPOINT_MIN, rounded));
}

const BUTTON_CLASS =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-anthracite-700 text-[13px] leading-none text-zinc-300 transition-colors hover:border-accent-500/50 hover:text-zinc-100 focus-visible:border-accent-400 focus-visible:outline-none sm:h-7 sm:w-7';

/**
 * Consigne de température modifiable : champ, boutons + et −, validation.
 * La saisie est un **brouillon** : rien ne part au moteur avant « Valider ».
 * Entrée valide, Échap annule.
 */
export function SetpointControl({
  value,
  fallback,
  onApply,
  variant = 'boxed',
}: SetpointControlProps) {
  const [draft, setDraft] = useState(() => formatMeasure(value, 1));

  // Une consigne validée ailleurs (ou par le rétablissement) réaligne le champ.
  useEffect(() => {
    setDraft(formatMeasure(value, 1));
  }, [value]);

  const parsed = parseDraft(draft);
  const pending = parsed === null ? null : clamp(parsed);
  const dirty = pending !== null && pending !== value;

  const step = (delta: number): void => {
    setDraft(formatMeasure(clamp((pending ?? value) + delta), 1));
  };

  const apply = (): void => {
    if (pending === null || !dirty) return;
    onApply(pending);
  };

  const stepButton =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] leading-none sm:h-6 sm:w-6 ' +
    'text-zinc-500 transition-colors hover:bg-anthracite-800 hover:text-zinc-100 ' +
    'focus-visible:bg-anthracite-800 focus-visible:text-zinc-100 focus-visible:outline-none ' +
    'disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent';

  if (variant === 'bare') {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-zinc-400">Consigne</span>
          <span className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => step(-SETPOINT_STEP)}
              disabled={pending === null || pending <= SETPOINT_MIN}
              aria-label={`Diminuer la consigne de ${formatMeasure(SETPOINT_STEP, 1)} degré`}
              className={stepButton}
            >
              −
            </button>

            <input
              type="text"
              inputMode="decimal"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.stopPropagation();
                  apply();
                }
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  setDraft(formatMeasure(value, 1));
                }
              }}
              aria-label="Consigne de température en degrés Celsius"
              aria-invalid={pending === null}
              title="Consigne de température en °C"
              className={
                pending === null
                  ? 'h-6 w-12 shrink-0 rounded-md bg-transparent px-1 text-right text-[12px] font-medium tabular-nums text-red-400 focus:bg-anthracite-800 focus:outline-none'
                  : 'h-6 w-12 shrink-0 rounded-md bg-transparent px-1 text-right text-[12px] font-medium tabular-nums text-zinc-100 transition-colors hover:bg-anthracite-800 focus:bg-anthracite-800 focus:outline-none'
              }
            />

            <button
              type="button"
              onClick={() => step(SETPOINT_STEP)}
              disabled={pending === null || pending >= SETPOINT_MAX}
              aria-label={`Augmenter la consigne de ${formatMeasure(SETPOINT_STEP, 1)} degré`}
              className={stepButton}
            >
              +
            </button>
          </span>
        </div>

        {dirty || value !== fallback ? (
          <span className="flex items-center justify-end gap-3">
            {value === fallback ? null : (
              <button
                type="button"
                onClick={() => onApply(fallback)}
                title={`Rétablir la consigne d'origine (${formatMeasure(fallback, 1)} °C)`}
                className="text-[10px] text-zinc-500 transition-colors hover:text-accent-300 focus-visible:text-accent-300 focus-visible:outline-none"
              >
                rétablir
              </button>
            )}
            {dirty ? (
              <button
                type="button"
                onClick={apply}
                title="Appliquer la consigne (Entrée)"
                className="text-[11px] font-medium text-accent-300 transition-colors hover:text-accent-200 focus-visible:text-accent-200 focus-visible:outline-none"
              >
                Valider {pending === null ? '' : formatMeasure(pending, 1)}
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 border-t border-anthracite-800 pt-2.5">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] text-zinc-500">Consigne</span>
        <span className="flex items-baseline gap-2">
          {value === fallback ? null : (
            <button
              type="button"
              onClick={() => onApply(fallback)}
              title={`Rétablir la consigne d'origine (${formatMeasure(fallback, 1)} °C)`}
              className="text-[10px] text-zinc-500 transition-colors hover:text-accent-300 focus-visible:text-accent-300 focus-visible:outline-none"
            >
              rétablir
            </button>
          )}
          <span className="text-[10px] text-zinc-600">°C</span>
        </span>
      </span>

      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => step(-SETPOINT_STEP)}
          disabled={pending === null || pending <= SETPOINT_MIN}
          aria-label={`Diminuer la consigne de ${formatMeasure(SETPOINT_STEP, 1)} degré`}
          className={`${BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          −
        </button>

        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Sans `stopPropagation`, Échap remonte jusqu'au `window` où App
            // écoute pour fermer la vue produit : annuler la saisie fermait
            // aussi la page.
            if (event.key === 'Enter') {
              event.stopPropagation();
              apply();
            }
            if (event.key === 'Escape') {
              event.stopPropagation();
              setDraft(formatMeasure(value, 1));
            }
          }}
          aria-label="Consigne de température en degrés Celsius"
          aria-invalid={pending === null}
          className={
            pending === null
              ? 'h-10 w-14 shrink-0 rounded-lg border border-red-500/60 bg-anthracite-950 px-1 text-center text-[12px] font-medium tabular-nums text-zinc-100 focus:outline-none sm:h-7 sm:w-12'
              : 'h-10 w-14 shrink-0 rounded-lg border border-anthracite-700 bg-anthracite-950 px-1 text-center text-[12px] font-medium tabular-nums text-zinc-100 focus:border-accent-500/60 focus:outline-none sm:h-7 sm:w-12'
          }
        />

        <button
          type="button"
          onClick={() => step(SETPOINT_STEP)}
          disabled={pending === null || pending >= SETPOINT_MAX}
          aria-label={`Augmenter la consigne de ${formatMeasure(SETPOINT_STEP, 1)} degré`}
          className={`${BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          +
        </button>

        <button
          type="button"
          onClick={apply}
          disabled={!dirty}
          title="Appliquer la consigne (Entrée)"
          className="ml-auto h-10 shrink-0 rounded-lg border border-accent-500/50 bg-accent-500/15 px-2.5 text-[11px] font-medium text-accent-300 transition-colors hover:border-accent-400 hover:bg-accent-500/25 focus-visible:border-accent-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:border-anthracite-700 disabled:bg-transparent disabled:text-zinc-600 sm:h-7"
        >
          Valider
        </button>
      </span>
    </div>
  );
}
