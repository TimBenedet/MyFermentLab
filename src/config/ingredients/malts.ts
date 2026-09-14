import type { MaltCatalogEntry } from '../../types';

/**
 * Malts, grains et flocons.
 *
 * **Provenance** : les fourchettes publiées par les malteries elles-mêmes dans leurs
 * fiches produit (couleur EBC, rendement à broyage grossier, part maximale du grist).
 * Ce ne sont pas des analyses de ton sac : deux lots du même malt n'ont pas la même
 * couleur à l'unité près, c'est pourquoi tout est donné en fourchette.
 *
 * Le fichier est **éditable sans toucher au code** : corriger un chiffre, c'est
 * corriger une ligne ici. Ajouter un malt, c'est ajouter une entrée.
 */
/** Corps d'une entrée de malt : la famille est la même pour tout le fichier, on ne la
 *  répète pas sur chaque ligne — elle est posée à l'export, une fois. */
type MaltEntry = Omit<MaltCatalogEntry, 'family'>;

const MALT_ENTRIES: readonly MaltEntry[] = [
  /* --- Weyermann (Allemagne) ------------------------------------------------------ */
  {
    id: 'malt-pilsner-weyermann',
    name: 'Pilsner · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Base',
    aliases: ['pils', 'pilsen'],
    spec: { colorEbc: [3, 5], yieldPct: [78, 82], maxPct: 100 },
  },
  {
    id: 'malt-pale-ale-weyermann',
    name: 'Pale Ale · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Base',
    spec: { colorEbc: [6, 8], yieldPct: [78, 82], maxPct: 100 },
  },
  {
    id: 'malt-vienna-weyermann',
    name: 'Vienna · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Base maltée',
    spec: { colorEbc: [7, 9], yieldPct: [77, 81], maxPct: 100 },
  },
  {
    id: 'malt-munich-1-weyermann',
    name: 'Munich I · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Base maltée',
    aliases: ['munich clair'],
    spec: { colorEbc: [12, 15], yieldPct: [76, 80], maxPct: 100 },
  },
  {
    id: 'malt-munich-2-weyermann',
    name: 'Munich II · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Base, pain grillé',
    aliases: ['munich foncé'],
    spec: { colorEbc: [20, 25], yieldPct: [75, 79], maxPct: 100 },
  },
  {
    id: 'malt-melanoidin-weyermann',
    name: 'Melanoidin · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Couleur, goût de four',
    spec: { colorEbc: [60, 80], yieldPct: [73, 77], maxPct: 10 },
  },
  {
    id: 'malt-carafoam-weyermann',
    name: 'Carafoam · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Corps, tenue de mousse',
    aliases: ['carapils'],
    spec: { colorEbc: [3, 5], yieldPct: [73, 77], maxPct: 10 },
  },
  {
    id: 'malt-carahell-weyermann',
    name: 'Carahell · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Cara clair, rondeur',
    spec: { colorEbc: [20, 30], yieldPct: [73, 77], maxPct: 15 },
  },
  {
    id: 'malt-caramunich-1-weyermann',
    name: 'Caramunich I · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Cara ambré',
    spec: { colorEbc: [80, 100], yieldPct: [72, 76], maxPct: 15 },
  },
  {
    id: 'malt-caramunich-2-weyermann',
    name: 'Caramunich II · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Cara cuivré',
    spec: { colorEbc: [110, 130], yieldPct: [71, 75], maxPct: 10 },
  },
  {
    id: 'malt-caramunich-3-weyermann',
    name: 'Caramunich III · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Cara foncé',
    spec: { colorEbc: [140, 160], yieldPct: [70, 74], maxPct: 10 },
  },
  {
    id: 'malt-caraaroma-weyermann',
    name: 'Caraaroma · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Cara très foncé, fruits secs',
    spec: { colorEbc: [350, 400], yieldPct: [70, 74], maxPct: 5 },
  },
  {
    id: 'malt-carafa-1-weyermann',
    name: 'Carafa Special I · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Couleur, déhusqué',
    spec: { colorEbc: [800, 900], yieldPct: [65, 70], maxPct: 5 },
  },
  {
    id: 'malt-carafa-2-weyermann',
    name: 'Carafa Special II · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Couleur, déhusqué',
    spec: { colorEbc: [1100, 1200], yieldPct: [63, 68], maxPct: 5 },
  },
  {
    id: 'malt-carafa-3-weyermann',
    name: 'Carafa Special III · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Couleur, déhusqué',
    spec: { colorEbc: [1300, 1500], yieldPct: [62, 67], maxPct: 5 },
  },
  {
    id: 'malt-chocolate-weyermann',
    name: 'Chocolat · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Torréfié, chocolat',
    aliases: ['chocolate'],
    spec: { colorEbc: [800, 1000], yieldPct: [65, 72], maxPct: 5 },
  },
  {
    id: 'malt-wheat-weyermann',
    name: 'Blé malté · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Blé, base',
    aliases: ['wheat', 'froment'],
    spec: { colorEbc: [3, 5], yieldPct: [80, 84], maxPct: 60 },
  },
  {
    id: 'malt-dark-wheat-weyermann',
    name: 'Blé malté foncé · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Blé foncé',
    aliases: ['dark wheat'],
    spec: { colorEbc: [15, 20], yieldPct: [78, 82], maxPct: 30 },
  },
  {
    id: 'malt-rye-weyermann',
    name: 'Seigle malté · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Seigle, épicé',
    aliases: ['rye'],
    spec: { colorEbc: [4, 6], yieldPct: [76, 80], maxPct: 30 },
  },
  {
    id: 'malt-rauch-weyermann',
    name: 'Malt fumé · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Fumé au bois de hêtre',
    aliases: ['rauch', 'rauchmalz', 'smoked'],
    spec: { colorEbc: [4, 8], yieldPct: [77, 81], maxPct: 100 },
  },
  {
    id: 'malt-sauer-weyermann',
    name: 'Malt acidulé · Weyermann',
    origin: 'Weyermann · Allemagne',
    role: 'Acidification du brassin',
    aliases: ['sauer', 'sauermalz', 'acidulated'],
    spec: { colorEbc: [3, 6], yieldPct: [77, 81], maxPct: 10 },
  },

  /* --- Dingemans (Belgique) ------------------------------------------------------- */
  {
    id: 'malt-pilsner-dingemans',
    name: 'Pilsner · Dingemans',
    origin: 'Dingemans · Belgique',
    role: 'Base',
    spec: { colorEbc: [3, 4], yieldPct: [79, 82], maxPct: 100 },
  },
  {
    id: 'malt-pale-ale-dingemans',
    name: 'Pale Ale · Dingemans',
    origin: 'Dingemans · Belgique',
    role: 'Base',
    spec: { colorEbc: [6, 9], yieldPct: [78, 82], maxPct: 100 },
  },
  {
    id: 'malt-biscuit-dingemans',
    name: 'Biscuit · Dingemans',
    origin: 'Dingemans · Belgique',
    role: 'Goût biscuité',
    spec: { colorEbc: [40, 50], yieldPct: [72, 76], maxPct: 10 },
  },
  {
    id: 'malt-aromatic-dingemans',
    name: 'Aromatic · Dingemans',
    origin: 'Dingemans · Belgique',
    role: 'Goût, noisette',
    spec: { colorEbc: [45, 55], yieldPct: [72, 76], maxPct: 10 },
  },
  {
    id: 'malt-special-b-dingemans',
    name: 'Special B · Dingemans',
    origin: 'Dingemans · Belgique',
    role: 'Cara foncé, fruits secs',
    spec: { colorEbc: [290, 320], yieldPct: [70, 74], maxPct: 10 },
  },

  /* --- Royaume-Uni et Écosse ----------------------------------------------------- */
  {
    id: 'malt-maris-otter-crisp',
    name: 'Maris Otter · Crisp',
    origin: 'Crisp · Royaume-Uni',
    role: 'Base, malt à l’ancienne',
    aliases: ['pale ale anglais'],
    spec: { colorEbc: [5, 7], yieldPct: [80, 83], maxPct: 100 },
  },
  {
    id: 'malt-roasted-barley-crisp',
    name: 'Orge torréfiée · Crisp',
    origin: 'Crisp · Royaume-Uni',
    role: 'Torréfié, amertume sèche',
    aliases: ['roasted barley'],
    spec: { colorEbc: [1300, 1500], yieldPct: [62, 68], maxPct: 5 },
  },
  {
    id: 'malt-golden-promise-simpsons',
    name: 'Golden Promise · Simpsons',
    origin: 'Simpsons · Écosse',
    role: 'Base, doux',
    spec: { colorEbc: [4, 6], yieldPct: [80, 83], maxPct: 100 },
  },

  /* --- États-Unis ---------------------------------------------------------------- */
  {
    id: 'malt-victory-briess',
    name: 'Victory · Briess',
    origin: 'Briess · États-Unis',
    role: 'Goût, pain grillé',
    spec: { colorEbc: [50, 60], yieldPct: [72, 76], maxPct: 15 },
  },
  {
    id: 'malt-special-roast-briess',
    name: 'Special Roast · Briess',
    origin: 'Briess · États-Unis',
    role: 'Goût, pain',
    spec: { colorEbc: [100, 130], yieldPct: [71, 75], maxPct: 10 },
  },
  {
    id: 'malt-pale-chocolate-briess',
    name: 'Pale Chocolate · Briess',
    origin: 'Briess · États-Unis',
    role: 'Couleur, chocolat doux',
    spec: { colorEbc: [500, 600], yieldPct: [67, 72], maxPct: 5 },
  },

  /* --- France -------------------------------------------------------------------- */
  {
    id: 'malt-pilsner-soufflet',
    name: 'Pilsner · Soufflet',
    origin: 'Soufflet · France',
    role: 'Base',
    spec: { colorEbc: [3, 5], yieldPct: [78, 82], maxPct: 100 },
  },

  /* --- Céréales non maltées ------------------------------------------------------ */
  {
    id: 'grain-flocons-avoine',
    name: 'Flocons d’avoine',
    origin: 'Céréale crue',
    role: 'Corps, onctuosité',
    aliases: ['flaked oats', 'avoine'],
    spec: { colorEbc: [2, 4], yieldPct: [60, 70], maxPct: 30 },
  },
  {
    id: 'grain-flocons-ble',
    name: 'Flocons de blé',
    origin: 'Céréale crue',
    role: 'Corps, blanche',
    aliases: ['flaked wheat'],
    spec: { colorEbc: [2, 4], yieldPct: [60, 70], maxPct: 30 },
  },
  {
    id: 'grain-flocons-orge',
    name: 'Flocons d’orge',
    origin: 'Céréale crue',
    role: 'Corps, mousse',
    aliases: ['flaked barley'],
    spec: { colorEbc: [2, 4], yieldPct: [60, 70], maxPct: 30 },
  },
];

export const MALTS: readonly MaltCatalogEntry[] = MALT_ENTRIES.map(
  (entry): MaltCatalogEntry => ({ ...entry, family: 'malt' }),
);
