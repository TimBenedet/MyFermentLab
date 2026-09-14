/**
 * Asservissement des prises : un thermostat tout simple.
 *
 * Sous la consigne, on allume les tapis chauffants ; à la consigne ou au-dessus, on
 * les éteint. Entre les deux, une **bande morte** : sans elle, une sonde qui oscille
 * de 0,1 °C ferait claquer le relais toutes les trente secondes, et un relais qui
 * claque s'use. Dans la bande morte on ne change rien — c'est le sens de « à
 * consigne ».
 *
 * Une seule mesure pilote le lot : la première sonde de température liée. Les prises
 * liées obéissent toutes ensemble — des tapis branchés sur la même chambre chauffent
 * la même chambre.
 */

/**
 * Demi-bande morte, en °C. Plus large que celle de l'affichage (0,1 °C) : c'est du
 * matériel, pas un tracé, et la sonde d'un Sonoff bruité se promène de quelques
 * dixièmes.
 */
export const HEAT_DEAD_BAND = 0.3;

/** Ce qu'on demande aux prises. */
export type HeatCommand = 'heat' | 'idle';

/**
 * État d'asservissement d'un lot, tel qu'il s'affiche.
 *
 * `temperature` est la mesure **de la sonde**, pas la valeur simulée : un lot sans
 * sonde qui répond n'a pas de température de commande, même s'il en affiche une.
 */
export interface HeatLot {
  readonly command: HeatCommand;
  /** Nombre de prises pilotées. */
  readonly outlets: number;
  readonly temperature: number | null;
}

/**
 * Commande à appliquer. `previous` est la commande en cours : c'est elle qui est
 * maintenue dans la bande morte, et c'est ce qui empêche les allers-retours.
 *
 * Sans mesure (`temperature === null`), on **coupe**. Une sonde muette ne doit pas
 * laisser un tapis chauffer sans surveillance : c'est le seul défaut qui s'aggrave
 * tout seul.
 */
export function decideHeat(
  temperature: number | null,
  setpoint: number,
  previous: HeatCommand,
): HeatCommand {
  if (temperature === null) return 'idle';
  if (temperature >= setpoint) return 'idle';
  if (temperature < setpoint - HEAT_DEAD_BAND) return 'heat';
  return previous;
}
