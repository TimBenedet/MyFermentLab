import type { YeastCatalogEntry } from '../../types';

/**
 * Levures, par laboratoire.
 *
 * **Provenance** : les fiches techniques des laboratoires (Fermentis, Lallemand,
 * White Labs, Wyeast, Mangrove Jack's) — atténuation, plage de température conseillée,
 * forme sèche ou liquide. L'atténuation dépend du moût : la fourchette publiée suppose
 * un moût brassable ordinaire, pas un moût très fermentescible ni un moût lourd.
 *
 * Les températures sont converties en degrés Celsius quand la fiche est en Fahrenheit.
 */
/** Corps d'une entrée de levure : la famille est posée à l'export, une fois. */
type YeastEntry = Omit<YeastCatalogEntry, 'family'>;

const YEAST_ENTRIES: readonly YeastEntry[] = [
  /* --- Fermentis (France) --------------------------------------------------------- */
  {
    id: 'yeast-us-05',
    name: 'SafAle US-05',
    origin: 'Fermentis · France',
    role: 'Ale américaine, neutre',
    aliases: ['US-05', 'Chico'],
    spec: { attenuationPct: [78, 82], temperatureC: [15, 22], form: 'sèche' },
  },
  {
    id: 'yeast-s-04',
    name: 'SafAle S-04',
    origin: 'Fermentis · France',
    role: 'Ale anglaise, floculation haute',
    aliases: ['S-04'],
    spec: { attenuationPct: [74, 82], temperatureC: [15, 20], form: 'sèche' },
  },
  {
    id: 'yeast-k-97',
    name: 'SafAle K-97',
    origin: 'Fermentis · France',
    role: 'Ale allemande, Kölsch',
    aliases: ['K-97'],
    spec: { attenuationPct: [78, 82], temperatureC: [15, 22], form: 'sèche' },
  },
  {
    id: 'yeast-wb-06',
    name: 'SafAle WB-06',
    origin: 'Fermentis · France',
    role: 'Blanche, phénolique',
    aliases: ['WB-06'],
    spec: { attenuationPct: [82, 86], temperatureC: [18, 24], form: 'sèche' },
  },
  {
    id: 'yeast-be-134',
    name: 'SafAle BE-134',
    origin: 'Fermentis · France',
    role: 'Saison, poivrée',
    aliases: ['BE-134'],
    spec: { attenuationPct: [88, 92], temperatureC: [18, 26], form: 'sèche' },
  },
  {
    id: 'yeast-t-58',
    name: 'SafAle T-58',
    origin: 'Fermentis · France',
    role: 'Belge, poivrée',
    aliases: ['T-58'],
    spec: { attenuationPct: [70, 76], temperatureC: [15, 22], form: 'sèche' },
  },
  {
    id: 'yeast-w-34-70',
    name: 'SafLager W-34/70',
    origin: 'Fermentis · France',
    role: 'Lager, neutre',
    aliases: ['W-34/70', '34/70', 'Weihenstephan'],
    spec: { attenuationPct: [80, 84], temperatureC: [9, 15], form: 'sèche' },
  },
  {
    id: 'yeast-s-23',
    name: 'SafLager S-23',
    origin: 'Fermentis · France',
    role: 'Lager fruitée',
    aliases: ['S-23'],
    spec: { attenuationPct: [80, 84], temperatureC: [9, 15], form: 'sèche' },
  },

  /* --- Lallemand (Canada) --------------------------------------------------------- */
  {
    id: 'yeast-nottingham',
    name: 'Nottingham',
    origin: 'Lallemand · Canada',
    role: 'Ale, neutre, très atténuante',
    spec: { attenuationPct: [77, 83], temperatureC: [10, 22], form: 'sèche' },
  },
  {
    id: 'yeast-windsor',
    name: 'Windsor',
    origin: 'Lallemand · Canada',
    role: 'Ale anglaise, ronde',
    spec: { attenuationPct: [68, 74], temperatureC: [15, 22], form: 'sèche' },
  },
  {
    id: 'yeast-london-esb',
    name: 'London ESB',
    origin: 'Lallemand · Canada',
    role: 'Ale anglaise, floculante',
    spec: { attenuationPct: [65, 70], temperatureC: [18, 22], form: 'sèche' },
  },
  {
    id: 'yeast-verdant-ipa',
    name: 'Verdant IPA',
    origin: 'Lallemand · Canada',
    role: 'IPA, fruits tropicaux',
    spec: { attenuationPct: [70, 75], temperatureC: [18, 23], form: 'sèche' },
  },
  {
    id: 'yeast-bry-97',
    name: 'BRY-97',
    origin: 'Lallemand · Canada',
    role: 'Ale américaine',
    spec: { attenuationPct: [75, 80], temperatureC: [15, 22], form: 'sèche' },
  },
  {
    id: 'yeast-voss',
    name: 'Voss Kveik',
    origin: 'Lallemand · Canada',
    role: 'Kveik, agrumes, très chaude',
    aliases: ['kveik'],
    spec: { attenuationPct: [75, 82], temperatureC: [25, 40], form: 'sèche' },
  },
  {
    id: 'yeast-lutra',
    name: 'Lutra Kveik',
    origin: 'Lallemand · Canada',
    role: 'Kveik, neutre',
    aliases: ['kveik'],
    spec: { attenuationPct: [75, 82], temperatureC: [22, 35], form: 'sèche' },
  },
  {
    id: 'yeast-belle-saison',
    name: 'Belle Saison',
    origin: 'Lallemand · Canada',
    role: 'Saison, diastatique',
    spec: { attenuationPct: [86, 92], temperatureC: [18, 26], form: 'sèche' },
  },
  {
    id: 'yeast-munich-classic',
    name: 'Munich Classic',
    origin: 'Lallemand · Canada',
    role: 'Blanche bavaroise',
    spec: { attenuationPct: [72, 77], temperatureC: [17, 22], form: 'sèche' },
  },
  {
    id: 'yeast-diamond-lager',
    name: 'Diamond Lager',
    origin: 'Lallemand · Canada',
    role: 'Lager',
    spec: { attenuationPct: [80, 84], temperatureC: [10, 15], form: 'sèche' },
  },
  {
    id: 'yeast-kolsch-lallemand',
    name: 'Kölsch',
    origin: 'Lallemand · Canada',
    role: 'Ale allemande',
    spec: { attenuationPct: [74, 79], temperatureC: [15, 20], form: 'sèche' },
  },

  /* --- White Labs (États-Unis) ---------------------------------------------------- */
  {
    id: 'yeast-wlp001',
    name: 'WLP001 California Ale',
    origin: 'White Labs · États-Unis',
    role: 'Ale américaine, neutre',
    aliases: ['WLP001'],
    spec: { attenuationPct: [73, 80], temperatureC: [20, 23], form: 'liquide' },
  },
  {
    id: 'yeast-wlp002',
    name: 'WLP002 English Ale',
    origin: 'White Labs · États-Unis',
    role: 'Ale anglaise, floculante',
    aliases: ['WLP002'],
    spec: { attenuationPct: [63, 70], temperatureC: [18, 20], form: 'liquide' },
  },
  {
    id: 'yeast-wlp029',
    name: 'WLP029 German Ale/Kölsch',
    origin: 'White Labs · États-Unis',
    role: 'Ale allemande',
    aliases: ['WLP029'],
    spec: { attenuationPct: [72, 78], temperatureC: [18, 21], form: 'liquide' },
  },
  {
    id: 'yeast-wlp830',
    name: 'WLP830 German Lager',
    origin: 'White Labs · États-Unis',
    role: 'Lager',
    aliases: ['WLP830'],
    spec: { attenuationPct: [74, 79], temperatureC: [10, 13], form: 'liquide' },
  },
  {
    id: 'yeast-wlp300',
    name: 'WLP300 Hefeweizen',
    origin: 'White Labs · États-Unis',
    role: 'Blanche bavaroise',
    aliases: ['WLP300'],
    spec: { attenuationPct: [72, 76], temperatureC: [20, 22], form: 'liquide' },
  },

  /* --- Wyeast (États-Unis) -------------------------------------------------------- */
  {
    id: 'yeast-1056',
    name: '1056 American Ale',
    origin: 'Wyeast · États-Unis',
    role: 'Ale américaine',
    aliases: ['Wyeast 1056'],
    spec: { attenuationPct: [73, 77], temperatureC: [16, 22], form: 'liquide' },
  },
  {
    id: 'yeast-1318',
    name: '1318 London Ale III',
    origin: 'Wyeast · États-Unis',
    role: 'Ale anglaise, ronde',
    aliases: ['Wyeast 1318'],
    spec: { attenuationPct: [71, 75], temperatureC: [17, 22], form: 'liquide' },
  },
  {
    id: 'yeast-3068',
    name: '3068 Weihenstephan Weizen',
    origin: 'Wyeast · États-Unis',
    role: 'Blanche bavaroise',
    aliases: ['Wyeast 3068'],
    spec: { attenuationPct: [73, 77], temperatureC: [17, 22], form: 'liquide' },
  },
  {
    id: 'yeast-3711',
    name: '3711 French Saison',
    origin: 'Wyeast · États-Unis',
    role: 'Saison, poivrée',
    aliases: ['Wyeast 3711'],
    spec: { attenuationPct: [77, 83], temperatureC: [18, 25], form: 'liquide' },
  },
  {
    id: 'yeast-2206',
    name: '2206 Bavarian Lager',
    origin: 'Wyeast · États-Unis',
    role: 'Lager bavaroise',
    aliases: ['Wyeast 2206'],
    spec: { attenuationPct: [73, 77], temperatureC: [8, 14], form: 'liquide' },
  },

  /* --- Mangrove Jack's (Nouvelle-Zélande) ----------------------------------------- */
  {
    id: 'yeast-m44',
    name: 'M44 US West Coast',
    origin: 'Mangrove Jack’s · Nouvelle-Zélande',
    role: 'Ale américaine',
    aliases: ['M44'],
    spec: { attenuationPct: [74, 78], temperatureC: [15, 23], form: 'sèche' },
  },
  {
    id: 'yeast-m20',
    name: 'M20 Bavarian Wheat',
    origin: 'Mangrove Jack’s · Nouvelle-Zélande',
    role: 'Blanche bavaroise',
    aliases: ['M20'],
    spec: { attenuationPct: [73, 77], temperatureC: [18, 24], form: 'sèche' },
  },
];

export const YEASTS: readonly YeastCatalogEntry[] = YEAST_ENTRIES.map(
  (entry): YeastCatalogEntry => ({ ...entry, family: 'yeast' }),
);
