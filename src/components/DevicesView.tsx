import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  byDisplayName,
  callSwitchService,
  displayName,
  formatState,
  isControllableSwitch,
  isUnreachable,
  TRACKED_FAMILIES,
  trackedFamilyOf,
  unitOf,
} from '../lib/homeassistant';
import type { EntityFamily, HassEntity, MetricIconKind } from '../lib/homeassistant';
import { STATUS_STYLES } from '../lib/status';
import { MetricIcon } from './MetricIcon';

/** Teinte d'icône par grandeur : reprend les couleurs de mesure du thème. */
const ICON_TONE: Readonly<Record<MetricIconKind, string>> = {
  temperature: 'text-metric-temperature',
  humidity: 'text-metric-humidity',
  power: 'text-zinc-400',
};

export interface DevicesViewProps {
  readonly entities: readonly HassEntity[];
  readonly error: string | null;
  readonly onRefresh: () => void;
}

interface FamilyGroup {
  readonly family: EntityFamily;
  readonly entities: readonly HassEntity[];
}

interface PendingState {
  readonly state: string;
  readonly expiresAt: number;
}

/** Au-delà de ce délai, l'état optimiste est abandonné au profit de la valeur réelle. */
const OVERRIDE_TTL_MS = 6_000;

function matches(entity: HassEntity, needle: string): boolean {
  if (needle === '') return true;
  const haystack = `${entity.entity_id} ${displayName(entity)} ${entity.state}`.toLowerCase();
  return haystack.includes(needle);
}

/**
 * Objets suivis par le dashboard, groupés par famille de capteur.
 * La liste défile dans son propre cadre : la page, elle, ne défile pas.
 */
export function DevicesView({ entities, error, onRefresh }: DevicesViewProps) {
  const [filter, setFilter] = useState('');
  const needle = filter.trim().toLowerCase();

  const tracked = useMemo(
    () => entities.filter((entity) => trackedFamilyOf(entity.entity_id) !== null),
    [entities],
  );

  const groups = useMemo<readonly FamilyGroup[]>(() => {
    return TRACKED_FAMILIES.map((family) => ({
      family,
      entities: tracked
        .filter((entity) => trackedFamilyOf(entity.entity_id)?.key === family.key)
        .filter((entity) => matches(entity, needle))
        .sort(byDisplayName),
    })).filter((group) => group.entities.length > 0 || needle === '');
  }, [tracked, needle]);

  const visible = groups.reduce((total, group) => total + group.entities.length, 0);
  const loading = entities.length === 0 && error === null;

  // État optimiste : l'affichage suit le clic, puis se cale sur la valeur confirmée.
  const [overrides, setOverrides] = useState<ReadonlyMap<string, PendingState>>(new Map());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  // La donnée fraîche a rejoint l'état optimiste : l'override n'a plus lieu d'être.
  useEffect(() => {
    setOverrides((current) => {
      if (current.size === 0) return current;
      const next = new Map(current);
      let changed = false;
      for (const entity of entities) {
        const override = next.get(entity.entity_id);
        if (override !== undefined && override.state === entity.state) {
          next.delete(entity.entity_id);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [entities]);

  /*
   * Filet de sécurité : Home Assistant peut accepter la commande (HTTP 200) sans que
   * l'appareil obéisse. L'état optimiste ne doit pas mentir indéfiniment — passé le
   * délai, on rend la main à la valeur réelle.
   */
  useEffect(() => {
    if (overrides.size === 0) return undefined;
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      setOverrides((current) => {
        let changed = false;
        const next = new Map(current);
        for (const [entityId, entry] of next) {
          if (entry.expiresAt <= now) {
            next.delete(entityId);
            changed = true;
          }
        }
        return changed ? next : current;
      });
    }, 1_000);
    return () => window.clearInterval(intervalId);
  }, [overrides]);

  const stateOf = useCallback(
    (entity: HassEntity): string => overrides.get(entity.entity_id)?.state ?? entity.state,
    [overrides],
  );

  const handleToggle = useCallback(
    async (entity: HassEntity): Promise<void> => {
      const target = stateOf(entity) === 'on' ? 'off' : 'on';
      setActionError(null);
      setOverrides((current) =>
        new Map(current).set(entity.entity_id, {
          state: target,
          expiresAt: Date.now() + OVERRIDE_TTL_MS,
        }),
      );
      setPending((current) => new Set(current).add(entity.entity_id));
      try {
        await callSwitchService(entity.entity_id, target === 'on');
        onRefresh();
      } catch (cause) {
        // Échec : on retire l'état optimiste, l'affichage revient au réel.
        setOverrides((current) => {
          const next = new Map(current);
          next.delete(entity.entity_id);
          return next;
        });
        setActionError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setPending((current) => {
          const next = new Set(current);
          next.delete(entity.entity_id);
          return next;
        });
      }
    },
    [onRefresh, stateOf],
  );

  // Sections repliables : toutes dépliées par défaut, et forcées ouvertes dès
  // qu'un filtre est actif — sinon un résultat pourrait rester invisible.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const toggleFamily = useCallback((key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-zinc-100">Devices</h2>
          <p className="text-[11px] text-zinc-500">
            Home Assistant · {tracked.length} objets suivis sur {entities.length} · sondes en
            lecture, prises pilotables
            {needle === '' ? '' : ` · ${visible} affichés`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filtrer…"
            aria-label="Filtrer les objets"
            className="w-32 rounded-lg border border-anthracite-700 bg-anthracite-900 px-3 py-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-500 focus:border-accent-500/60 focus:outline-none sm:w-48 sm:py-1.5"
          />
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg border border-anthracite-700 px-3 py-2.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-accent-500/50 hover:text-zinc-100 sm:py-1.5"
          >
            Rafraîchir
          </button>
        </div>
      </div>

      {error !== null ? (
        <p className={`text-[11px] ${STATUS_STYLES.alarm.textClass}`}>
          {error} — vérifie que le jeton Home Assistant est valide et que la VM répond.
        </p>
      ) : null}

      {actionError !== null ? (
        <p className={`text-[11px] ${STATUS_STYLES.alarm.textClass}`}>{actionError}</p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {loading ? (
          <p className="px-1 py-2 text-[11px] text-zinc-500">Chargement des objets…</p>
        ) : null}

        {!loading && visible === 0 && error === null ? (
          <p className="px-1 py-2 text-[11px] text-zinc-500">
            Aucun objet ne correspond au filtre.
          </p>
        ) : null}

        {groups.map((group) => {
          const open = needle !== '' || !collapsed.has(group.family.key);
          return (
            <div
              key={group.family.key}
              className="shrink-0 overflow-hidden rounded-xl border border-anthracite-800 bg-anthracite-900"
            >
              <button
                type="button"
                onClick={() => toggleFamily(group.family.key)}
                aria-expanded={open}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-anthracite-850 focus-visible:outline-none ${open ? 'border-b border-anthracite-800' : ''}`}
              >
                <span
                  aria-hidden="true"
                  className={`shrink-0 text-[12px] text-zinc-500 transition-transform ${open ? 'rotate-90' : ''}`}
                >
                  ›
                </span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-anthracite-800 ${ICON_TONE[group.family.icon]}`}
                >
                  <MetricIcon kind={group.family.icon} className="h-3.5 w-3.5" />
                </span>
                <span className="shrink-0 text-[13px] font-medium text-zinc-200">
                  {group.family.label}
                </span>
                <span className="hidden min-w-0 flex-1 truncate font-mono text-[10px] text-zinc-600 sm:block">
                  {group.family.pattern}
                </span>
                <span className="shrink-0 rounded-full bg-anthracite-800 px-2 py-0.5 text-[10px] tabular-nums text-zinc-400">
                  {group.entities.length}
                </span>
              </button>

              {!open ? null : group.entities.length === 0 ? (
                <p className="px-4 py-2 text-[11px] text-zinc-600">aucun objet</p>
              ) : (
                group.entities.map((entity) => {
                  const unit = unitOf(entity);
                  const raw = stateOf(entity);
                  const power: 'on' | 'off' | null =
                    raw === 'on' ? 'on' : raw === 'off' ? 'off' : null;
                  const name = displayName(entity);
                  return (
                    <div
                      key={entity.entity_id}
                      className="flex items-center justify-between gap-4 border-b border-anthracite-800 px-4 py-2.5 transition-colors last:border-b-0 hover:bg-anthracite-850"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] text-zinc-100">{name}</div>
                        <div className="truncate font-mono text-[11px] text-zinc-500">
                          {entity.entity_id}
                        </div>
                      </div>

                      {isControllableSwitch(entity) && power !== null ? (
                        <button
                          type="button"
                          onClick={() => {
                            void handleToggle(entity);
                          }}
                          disabled={pending.has(entity.entity_id)}
                          role="switch"
                          aria-checked={power === 'on'}
                          aria-label={name}
                          title={power === 'on' ? `Éteindre ${name}` : `Allumer ${name}`}
                          className={
                            power === 'on'
                              ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 transition-colors hover:border-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50'
                              : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 transition-colors hover:border-red-400 hover:bg-red-500/20 disabled:opacity-50'
                          }
                        >
                          <MetricIcon kind="power" className="h-4 w-4" />
                        </button>
                      ) : (
                        <div className="shrink-0 text-right">
                          <span
                            className={
                              isUnreachable(entity)
                                ? `text-[13px] tabular-nums ${STATUS_STYLES.alarm.textClass}`
                                : 'text-[13px] font-medium tabular-nums text-zinc-100'
                            }
                          >
                            {formatState(entity.state)}
                          </span>
                          {unit === null ? null : (
                            <span className="ml-1 text-[11px] text-zinc-500">{unit}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
