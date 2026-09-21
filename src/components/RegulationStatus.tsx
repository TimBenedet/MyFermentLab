import type { HeatLot } from '../lib/control';
import { formatSigned } from '../lib/format';
import { REGULATION_STYLES, classifyRegulation, temperatureRate } from '../lib/regulation';
import type { RegulationState } from '../lib/regulation';
import type { FermentReading } from '../types';
import { MetricRow } from './MetricRow';

export interface RegulationStatusProps {
  readonly reading: FermentReading;
  /** `pill` : bandeau teinté pleine largeur. `inline` : une ligne, point coloré. */
  readonly variant?: 'pill' | 'inline';
  /**
   * Asservissement réel des prises, quand le lot en a un. L'état affiché n'est alors
   * plus une estimation déduite de l'écart : c'est la commande envoyée aux prises.
   */
  readonly heat?: HeatLot | null;
}

/** Ce que fait l'asservissement, en clair : combien de prises, et pourquoi. */
function describeHeat(heat: HeatLot): string {
  const outlets = `${heat.outlets} ${heat.outlets > 1 ? 'prises' : 'prise'}`;
  if (heat.temperature === null) {
    return `Aucune mesure : les ${outlets} sont coupées`;
  }
  return heat.command === 'heat'
    ? `Tapis chauffants allumés (${outlets}) : la cuve est sous la consigne`
    : `Tapis chauffants coupés (${outlets}) : la consigne est atteinte`;
}

/** État de la boucle de régulation : chauffe, refroidissement, repos — ou sonde muette. */
export function RegulationStatus({ reading, variant = 'pill', heat }: RegulationStatusProps) {
  const { config, current, history } = reading;
  const setpoint = config.setpoints.temperature;
  let state: RegulationState;
  if (setpoint === null) {
    // Sans consigne, la boucle n'a pas de cible : rien n'est asservi.
    state = 'untargeted';
  } else if (heat != null) {
    state = heat.temperature === null ? 'muted' : heat.command === 'heat' ? 'heating' : 'holding';
  } else {
    state = classifyRegulation(current.temperature - setpoint);
  }
  const style = REGULATION_STYLES[state];
  const description =
    heat == null || state === 'untargeted' ? style.description : describeHeat(heat);
  const rate = temperatureRate(history, current.t);

  if (variant === 'inline') {
    return (
      <div className="flex items-baseline justify-between gap-2" title={description}>
        <span className="flex items-center gap-1.5 text-[11px]">
          <span className={`h-1.5 w-1.5 rounded-full ${style.dotClass}`} aria-hidden="true" />
          <span className={`font-medium ${style.textClass}`}>{style.label}</span>
        </span>
        <span className="text-[12px] font-medium tabular-nums text-zinc-300">
          {rate === null ? '—' : `${formatSigned(rate, 1)} °C/h`}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-anthracite-800 pt-2.5">
      <span className="text-[10px] text-zinc-500">Régulation</span>

      <span
        title={description}
        className={`flex items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium ${style.pillClass}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${style.dotClass}`} aria-hidden="true" />
        {style.label}
      </span>

      <MetricRow label="Vitesse">
        {rate === null ? '—' : `${formatSigned(rate, 1)} °C/h`}
      </MetricRow>
    </div>
  );
}
