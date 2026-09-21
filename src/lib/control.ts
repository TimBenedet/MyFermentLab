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
 * Bande morte de l'asservissement, en °C : c'est l'écart **sous la consigne** à partir
 * duquel on rallume. Plus large que celle de l'affichage (0,1 °C) : c'est du matériel,
 * pas un tracé, et la sonde d'un Sonoff bruité se promène de quelques dixièmes.
 *
 * Une seule valeur pour toutes les recettes : la cuve oscille sur trois dixièmes, l'écart
 * affiché franchit le seuil de dérive (0,2 °C) juste avant chaque rallumage, mais jamais
 * celui d'alarme (1 °C).
 */
export const HEAT_DEAD_BAND = 0.3;

/**
 * Plage de consigne admise par l'interface. La consigne n'est plus réservée à la
 * fermentation : chauffer de l'eau à 60 °C, ou tenir une pièce froide, doit rester
 * possible. De la glace fondante à au-delà de l'ébullition, on laisse la main —
 * c'est l'utilisateur qui sait ce qu'il chauffe, et avec quoi.
 */
export const SETPOINT_MIN = 0;
export const SETPOINT_MAX = 150;

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
 * Sans mesure (`temperature === null`) **ou sans consigne** (`setpoint === null`), on
 * coupe : un tapis ne doit pas chauffer sans surveillance ni sans cible.
 */
export function decideHeat(
  temperature: number | null,
  setpoint: number | null,
  previous: HeatCommand,
): HeatCommand {
  if (temperature === null || setpoint === null) return 'idle';
  if (temperature >= setpoint) return 'idle';
  if (temperature < setpoint - HEAT_DEAD_BAND) return 'heat';
  return previous;
}
