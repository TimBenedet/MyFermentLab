export type FermentId = 'ipa' | 'hydromel' | 'koji' | 'miso' | 'garum';
/**
 * Famille du ferment. C'est elle qui décide des capacités de suivi, pas l'identifiant.
 * Toutes les familles n'ont pas de ferment sur l'accueil : `soy` (sauce soja) n'existe
 * que par les recettes de la bibliothèque — voir `FERMENTATION_BY_KIND`.
 */
export type FermentKind = 'beer' | 'mead' | 'koji' | 'miso' | 'garum' | 'soy';
export type StatusLevel = 'ok' | 'warn' | 'alarm';

/**
 * Clé d'un lot suivi : les cinq ferments du tableau de bord (`FermentId`) ou une
 * production lancée depuis la bibliothèque, qui porte l'identifiant de sa recette.
 * Les deux se croisent dans le même flux sans se confondre.
 */
export type BatchId = string;

export interface ChannelDynamics {
  readonly noise: number; // écart type du bruit blanc, par racine de seconde
  readonly cycleAmplitude: number; // amplitude du cycle lent de régulation
  readonly burstScale: number; // amplitude des perturbations ponctuelles
}
export interface Setpoints {
  readonly temperature: number;
  readonly humidity: number | null;
}
export interface Dynamics {
  readonly temperature: ChannelDynamics;
  readonly humidity: ChannelDynamics | null;
}
export interface GravitySetpoint {
  readonly original: number;
  readonly final: number;
  readonly elapsedHours: number;
}

export interface TankVesselConfig {
  readonly kind: 'tank';
  readonly label: string;
  readonly liquid: string;
}
export interface KojiVesselConfig {
  readonly kind: 'koji';
  readonly label: string;
  readonly substrate: string;
  readonly spore: string;
}
export interface CrockVesselConfig {
  readonly kind: 'crock';
  readonly label: string;
  /** Ce que la jarre contient — « pâte de soja », « moût de soja » : entre dans la
   *  description du schéma, un miso et une sauce ne se nomment pas pareil. */
  readonly contents: string;
  readonly paste: readonly string[];
}
export type VesselConfig = TankVesselConfig | KojiVesselConfig | CrockVesselConfig;

export interface FermentConfig {
  /** Clé unique dans le flux : un ferment du tableau de bord ou une production. */
  readonly id: BatchId;
  readonly kind: FermentKind;
  readonly name: string;
  readonly context: string;
  readonly setpoints: Setpoints;
  readonly dynamics: Dynamics;
  readonly gravity: GravitySetpoint | null;
  readonly vessel: VesselConfig | null;
  readonly seed: number; // graine du générateur, historique reproductible
}
export interface Sample {
  readonly t: number;
  readonly temperature: number;
  readonly humidity: number | null;
  readonly density: number | null;
}
export interface FermentReading {
  readonly config: FermentConfig;
  readonly current: Sample;
  readonly history: readonly Sample[];
}
export interface Feed {
  readonly fermentations: Record<FermentId, FermentReading>;
  /** Lots lancés depuis la bibliothèque, dans l'ordre de lancement. */
  readonly productions: readonly FermentReading[];
  readonly timestamp: number;
}

/** Unités proposées pour un ingrédient. `%` sert aux proportions. */
export type RecipeUnit = 'g' | 'kg' | 'mL' | 'L' | '%';

/**
 * Un ingrédient de recette : un nom libre et un poids.
 * Le nom n'est pas un catalogue : on écrit ce qu'on veut, en autant de lignes
 * qu'on veut, dans l'ordre qu'on veut.
 */
export interface RecipeIngredient {
  /** Clé de la ligne dans le formulaire : elle survit au renommage, pas l'index. */
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly unit: RecipeUnit;
  /**
   * Couleur du malt, en EBC. Proposée par le référentiel au choix d'un malt, puis
   * **modifiable** : la fiche de ton sac fait foi, pas la fourchette publiée. Absente
   * tant qu'on ne l'a pas renseignée — une recette de miso n'en a jamais.
   */
  readonly ebc?: number;
  /** Acides alpha du houblon, en pourcentage. Même règle que `ebc`. */
  readonly aaPct?: number;
}

/**
 * Appareil Home Assistant lié à une recette : une **sonde** qui mesure, ou une
 * **prise** qui commande. Le libellé est recopié au moment de la liaison : une recette
 * reste lisible quand Home Assistant ne répond pas, et un appareil retiré de
 * l'installation ne devient pas un identifiant opaque.
 */
export interface RecipeDevice {
  /** `entity_id` Home Assistant — c'est lui qui fait foi, le libellé n'est qu'un cache. */
  readonly entityId: string;
  readonly label: string;
}

/**
 * Les trois réglages qui décrivent une **cuve** — voir `lib/equipment.ts`.
 *
 * Aucun ne dépend de la bière qu'on y brasse : ils changent quand on change de
 * matériel ou de technique, pas quand on change de recette. C'est pourquoi ils sont
 * rangés une seule fois, et non recopiés dans chaque recette.
 */
export interface EquipmentSettings {
  /** Débit d'évaporation de la cuve, en litres par heure — il suit la surface et le feu. */
  readonly boilOffLPerH: number;
  /** Ce qui reste dans la cuve : trub, houblon, espace mort. En litres. */
  readonly kettleLossL: number;
  /** Eau retenue par le grain, en litres par kilo — 0,5 quand on presse le sac. */
  readonly absorptionLPerKg: number;
}

/** Une cuve nommée : ce que la bibliothèque garde, et ce qu'une recette emploie. */
export interface EquipmentProfile extends EquipmentSettings {
  readonly id: string;
  readonly name: string;
}

/**
 * Le calcul d'eau d'une recette de bière, menée en **BIAB** : tout le volume part en
 * une fois dans la cuve, il n'y a pas d'eau de rinçage.
 *
 * La recette ne garde que ce qui lui appartient — le volume visé et la durée
 * d'ébullition. Les réglages de la cuve vivent dans le matériel (`EquipmentProfile`) :
 * une recette pâle et une stout brassées dans la même marmite partagent son évaporation.
 */
export interface BrewWater {
  /** Volume visé dans le fermenteur, à 20 °C, en litres. */
  readonly volumeL: number;
  /** Durée d'ébullition, en minutes : elle décide de ce qui s'évapore, et c'est un choix de recette. */
  readonly boilMinutes: number;
}

export interface Recipe {
  readonly id: string;
  readonly name: string;
  readonly kind: FermentKind;
  readonly ingredients: readonly RecipeIngredient[];
  /**
   * Calcul d'eau du brassin — renseigné sur une bière, absent partout ailleurs : un
   * miso n'a pas de grain à rincer. Une recette sans plan reste une recette valide.
   */
  readonly water?: BrewWater;
  /**
   * Consigne de température de la recette, en °C. Absente, le lot hérite de la
   * consigne du ferment de référence de son type ; renseignée, c'est elle qui fait
   * foi au lancement — une eau à chauffer à 60 °C n'est pas une fermentation.
   */
  readonly setpoint?: number;
  /** Appareils liés, dans l'ordre du choix. Vide quand la recette n'en suit aucun. */
  readonly devices: readonly RecipeDevice[];
  /**
   * Archivée : rangée, plus proposée dans la bibliothèque courante. Une recette
   * archivée ne se lance pas — il faut d'abord la désarchiver.
   */
  readonly archived: boolean;
}

/**
 * Un lot en production : une recette qu'on a lancée. La production ne porte pas de
 * mesure — le moteur en fait un ferment comme un autre à partir de son type. Nom,
 * type et appareils sont **recopiés** au lancement : le lot reste lisible et la recette
 * peut être modifiée ou supprimée sans le casser.
 *
 * Les prises d'un lot sont **asservies** : sous la consigne on allume, à la consigne ou
 * au-dessus on éteint (voir `lib/control.ts`).
 */
export interface Production {
  readonly id: string;
  readonly recipeId: string;
  readonly recipeName: string;
  readonly kind: FermentKind;
  readonly startedAt: number;
  /**
   * Consigne recopiée de la recette au lancement, en °C — `null` quand la recette
   * n'en portait pas : le lot retombe alors sur la consigne du type.
   */
  readonly setpoint: number | null;
  /**
   * Consigne choisie sur la fiche du lot, persistée pour survivre au rechargement.
   * `null` tant que rien n'a été changé : la consigne de la recette fait foi.
   */
  readonly overrideSetpoint: number | null;
  readonly devices: readonly RecipeDevice[];
}

/* ------------------------------------------------------------------------------------
 * Référentiel d'ingrédients de brasserie
 *
 * Un **référentiel**, pas un modèle stocké : une recette ne garde jamais que le nom, le
 * poids et l'unité d'une ligne. Ces entrées ne servent qu'au menu déroulant du
 * formulaire, et c'est pour cela qu'elles portent des **fourchettes** et non des
 * valeurs : la couleur d'un malt, le rendement d'un lot, l'alpha d'une récolte
 * varient à l'intérieur de la fourchette publiée par le producteur.
 * --------------------------------------------------------------------------------- */
export type IngredientFamily = 'malt' | 'hop' | 'yeast';

/** Fourchette fermée, telle que publiée : `[3, 5]` s'écrit « 3–5 ». */
export type CatalogRange = readonly [number, number];

interface CatalogBase {
  readonly id: string;
  /** Nom affiché **et recopié** dans la recette : « Pilsner · Weyermann ». */
  readonly name: string;
  /** Producteur ou pays : « Weyermann · Allemagne », « États-Unis ». */
  readonly origin: string;
  /** Emploi en clair, avec les arômes quand ils comptent : « Aromatique · agrumes ». */
  readonly role: string;
  /** Sigles et autres noms, pour la recherche : « EKG », « CTZ ». */
  readonly aliases?: readonly string[];
}

export interface MaltCatalogEntry extends CatalogBase {
  readonly family: 'malt';
  readonly spec: {
    readonly colorEbc: CatalogRange;
    readonly yieldPct: CatalogRange;
    /** Part maximale du grist, quand la fiche produit la donne. */
    readonly maxPct?: number;
  };
}

export interface HopCatalogEntry extends CatalogBase {
  readonly family: 'hop';
  readonly spec: {
    readonly alphaPct: CatalogRange;
  };
}

export interface YeastCatalogEntry extends CatalogBase {
  readonly family: 'yeast';
  readonly spec: {
    readonly attenuationPct: CatalogRange;
    readonly temperatureC: CatalogRange;
    readonly form: 'sèche' | 'liquide';
  };
}

/** Union discriminée par `family` : une famille sans forme d'entrée ne compile pas. */
export type CatalogIngredient = MaltCatalogEntry | HopCatalogEntry | YeastCatalogEntry;
