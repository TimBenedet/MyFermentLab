/**
 * Bibliothèque d'ingrédients pour le brassage
 * Données de référence pour malts, houblons et levures
 */

// ========================================
// MALTS ET GRAINS
// ========================================

export interface MaltData {
  name: string;
  category: 'base' | 'specialty' | 'crystal' | 'roasted' | 'adjunct';
  color: number; // EBC
  potential: number; // Points de densité par kg/L
  description?: string;
}

export const MALTS_DATABASE: MaltData[] = [
  // Malts de base
  { name: 'Pilsner', category: 'base', color: 3, potential: 38, description: 'Malt de base clair, saveur douce et maltée' },
  { name: 'Pale Ale', category: 'base', color: 6, potential: 37, description: 'Malt de base légèrement plus coloré, notes biscuitées' },
  { name: 'Maris Otter', category: 'base', color: 5, potential: 38, description: 'Malt anglais premium, riche et complexe' },
  { name: 'Vienna', category: 'base', color: 8, potential: 36, description: 'Malt légèrement toasté, notes de pain' },
  { name: 'Munich Type I', category: 'base', color: 15, potential: 35, description: 'Malt Munich clair, notes maltées prononcées' },
  { name: 'Munich Type II', category: 'base', color: 25, potential: 35, description: 'Malt Munich foncé, arômes intenses' },
  { name: 'Wheat Malt (Blé)', category: 'base', color: 4, potential: 38, description: 'Malt de blé, tenue de mousse, onctuosité' },

  // Malts Crystal/Caramel
  { name: 'Carapils / Dextrine', category: 'crystal', color: 3, potential: 33, description: 'Corps et tenue de mousse sans couleur' },
  { name: 'CaraHell', category: 'crystal', color: 25, potential: 34, description: 'Notes de caramel léger, miel' },
  { name: 'CaraMunich I', category: 'crystal', color: 80, potential: 34, description: 'Caramel prononcé, toffee' },
  { name: 'CaraMunich II', category: 'crystal', color: 120, potential: 34, description: 'Caramel intense, fruits secs' },
  { name: 'CaraMunich III', category: 'crystal', color: 150, potential: 34, description: 'Caramel foncé, raisins' },
  { name: 'Crystal 60', category: 'crystal', color: 120, potential: 34, description: 'Caramel classique américain' },
  { name: 'Crystal 120', category: 'crystal', color: 240, potential: 33, description: 'Caramel foncé, fruits noirs' },
  { name: 'Special B', category: 'crystal', color: 300, potential: 32, description: 'Raisins, pruneaux, caramel brûlé' },

  // Malts torréfiés
  { name: 'Chocolate', category: 'roasted', color: 800, potential: 30, description: 'Notes de chocolat noir, café léger' },
  { name: 'Black Malt', category: 'roasted', color: 1300, potential: 28, description: 'Couleur intense, notes de café brûlé' },
  { name: 'Roasted Barley', category: 'roasted', color: 1100, potential: 28, description: 'Orge torréfié, café, caractère sec' },
  { name: 'Carafa I', category: 'roasted', color: 800, potential: 30, description: 'Couleur sans amertume (dehusked)' },
  { name: 'Carafa II', category: 'roasted', color: 1100, potential: 30, description: 'Couleur intense, doux' },
  { name: 'Carafa III', category: 'roasted', color: 1400, potential: 30, description: 'Très foncé, reste doux' },
  { name: 'Pale Chocolate', category: 'roasted', color: 500, potential: 32, description: 'Chocolat au lait, noisette' },

  // Malts spéciaux
  { name: 'Biscuit', category: 'specialty', color: 50, potential: 35, description: 'Notes de biscuit, pain grillé' },
  { name: 'Victory', category: 'specialty', color: 50, potential: 35, description: 'Notes de noisette, biscuit' },
  { name: 'Aromatic', category: 'specialty', color: 50, potential: 35, description: 'Arôme malté intense' },
  { name: 'Honey Malt', category: 'specialty', color: 50, potential: 35, description: 'Notes de miel, pain d\'épices' },
  { name: 'Melanoidin', category: 'specialty', color: 70, potential: 35, description: 'Corps, couleur, notes de miel' },
  { name: 'Smoked Malt', category: 'specialty', color: 6, potential: 37, description: 'Fumé au bois de hêtre' },
  { name: 'Acidulated Malt', category: 'specialty', color: 3, potential: 35, description: 'Acidification du moût' },

  // Adjuncts
  { name: 'Flocons d\'avoine', category: 'adjunct', color: 2, potential: 32, description: 'Onctuosité, tenue de mousse' },
  { name: 'Flocons de blé', category: 'adjunct', color: 2, potential: 34, description: 'Trouble, onctuosité' },
  { name: 'Flocons d\'orge', category: 'adjunct', color: 2, potential: 32, description: 'Corps, texture' },
  { name: 'Riz', category: 'adjunct', color: 1, potential: 38, description: 'Légèreté, sécheresse' },
  { name: 'Maïs', category: 'adjunct', color: 2, potential: 37, description: 'Légèreté, douceur' },
];

// ========================================
// HOUBLONS
// ========================================

export interface HopData {
  name: string;
  origin: string;
  alphaAcid: { min: number; max: number };
  profile: string[];
  description?: string;
}

export const HOPS_DATABASE: HopData[] = [
  // Houblons américains
  { name: 'Amarillo', origin: 'USA', alphaAcid: { min: 8, max: 11 }, profile: ['agrumes', 'orange', 'floral'], description: 'Agrumes intenses, orange, notes florales' },
  { name: 'Cascade', origin: 'USA', alphaAcid: { min: 4.5, max: 7 }, profile: ['pamplemousse', 'floral', 'épicé'], description: 'Classique américain, pamplemousse, floral' },
  { name: 'Centennial', origin: 'USA', alphaAcid: { min: 9.5, max: 11.5 }, profile: ['agrumes', 'floral', 'citron'], description: 'Super Cascade, citron intense' },
  { name: 'Chinook', origin: 'USA', alphaAcid: { min: 12, max: 14 }, profile: ['pin', 'pamplemousse', 'épicé'], description: 'Résineux, pin, pamplemousse' },
  { name: 'Citra', origin: 'USA', alphaAcid: { min: 11, max: 13 }, profile: ['tropical', 'mangue', 'litchi', 'agrumes'], description: 'Fruits tropicaux intenses, mangue, passion' },
  { name: 'Columbus/Tomahawk/Zeus (CTZ)', origin: 'USA', alphaAcid: { min: 14, max: 17 }, profile: ['terreux', 'épicé', 'agrumes'], description: 'Amérisant polyvalent, notes terreuses' },
  { name: 'El Dorado', origin: 'USA', alphaAcid: { min: 14, max: 16 }, profile: ['tropical', 'bonbon', 'pastèque'], description: 'Fruits tropicaux, bonbon, unique' },
  { name: 'Galaxy', origin: 'Australie', alphaAcid: { min: 13, max: 15 }, profile: ['passion', 'pêche', 'agrumes'], description: 'Fruit de la passion intense, pêche' },
  { name: 'Mosaic', origin: 'USA', alphaAcid: { min: 11.5, max: 13.5 }, profile: ['tropical', 'baies', 'terreux', 'herbal'], description: 'Complexe, tropical, baies, herbes' },
  { name: 'Simcoe', origin: 'USA', alphaAcid: { min: 12, max: 14 }, profile: ['pin', 'agrumes', 'passion', 'baies'], description: 'Pin, fruits tropicaux, complexe' },
  { name: 'Idaho 7', origin: 'USA', alphaAcid: { min: 13, max: 17 }, profile: ['tropical', 'pin', 'agrumes'], description: 'Tropical, résineux, abricot' },
  { name: 'Sabro', origin: 'USA', alphaAcid: { min: 14, max: 16 }, profile: ['noix de coco', 'tropical', 'agrumes'], description: 'Noix de coco unique, tangerine' },
  { name: 'Strata', origin: 'USA', alphaAcid: { min: 11, max: 14 }, profile: ['passion', 'cannabis', 'tropical'], description: 'Fruit de la passion, dank, unique' },
  { name: 'Azacca', origin: 'USA', alphaAcid: { min: 14, max: 16 }, profile: ['tropical', 'mangue', 'agrumes'], description: 'Tropical intense, mangue, agrumes' },
  { name: 'Ekuanot', origin: 'USA', alphaAcid: { min: 13, max: 15 }, profile: ['papaye', 'agrumes', 'poivre'], description: 'Papaye, citron, notes poivrées' },
  { name: 'Vic Secret', origin: 'Australie', alphaAcid: { min: 14, max: 17 }, profile: ['tropical', 'pin', 'herbal'], description: 'Tropical, pin, passion' },
  { name: 'Talus', origin: 'USA', alphaAcid: { min: 10, max: 12 }, profile: ['agrumes', 'pin', 'floral'], description: 'Pamplemousse rose, floral' },
  { name: 'HBC 586', origin: 'USA', alphaAcid: { min: 11, max: 13 }, profile: ['tropical', 'bonbon', 'agrumes'], description: 'Bonbon fruité, tropical' },
  { name: 'Lotus', origin: 'USA', alphaAcid: { min: 15, max: 17 }, profile: ['orange', 'vanille', 'tropical'], description: 'Orange creamsicle, vanille' },
  { name: 'Cryo Citra', origin: 'USA', alphaAcid: { min: 22, max: 26 }, profile: ['tropical', 'mangue', 'litchi'], description: 'Citra concentré, lupuline pure' },
  { name: 'Cryo Mosaic', origin: 'USA', alphaAcid: { min: 20, max: 24 }, profile: ['tropical', 'baies', 'herbal'], description: 'Mosaic concentré, lupuline pure' },
  { name: 'Willamette', origin: 'USA', alphaAcid: { min: 4, max: 6 }, profile: ['floral', 'fruité', 'épicé'], description: 'Fuggle américain, doux, floral' },
  { name: 'Crystal', origin: 'USA', alphaAcid: { min: 3.5, max: 5.5 }, profile: ['floral', 'épicé', 'boisé'], description: 'Hallertau américain, délicat' },
  { name: 'Mt. Hood', origin: 'USA', alphaAcid: { min: 4, max: 8 }, profile: ['épicé', 'herbal', 'propre'], description: 'Noble américain, polyvalent' },
  { name: 'Liberty', origin: 'USA', alphaAcid: { min: 3, max: 5 }, profile: ['épicé', 'floral', 'citron'], description: 'Style Hallertau, citron léger' },
  { name: 'Sterling', origin: 'USA', alphaAcid: { min: 6, max: 9 }, profile: ['épicé', 'floral', 'herbal'], description: 'Style Saaz, herbal épicé' },
  { name: 'Ahtanum', origin: 'USA', alphaAcid: { min: 5.7, max: 6.3 }, profile: ['citron', 'floral', 'terreux'], description: 'Citron, géranium, terreux' },
  { name: 'Equinox', origin: 'USA', alphaAcid: { min: 14, max: 15.5 }, profile: ['citron', 'papaye', 'poivre vert'], description: 'Citron vert, tropical, épicé' },
  { name: 'Sultana', origin: 'USA', alphaAcid: { min: 6, max: 8 }, profile: ['tropical', 'pin', 'agrumes'], description: 'Tropical fruité, doux' },

  // Houblons européens
  { name: 'Saaz', origin: 'République Tchèque', alphaAcid: { min: 3, max: 4.5 }, profile: ['épicé', 'herbal', 'terreux'], description: 'Noble hop, épicé délicat, terreux' },
  { name: 'Hallertau Mittelfrüh', origin: 'Allemagne', alphaAcid: { min: 3, max: 5.5 }, profile: ['floral', 'épicé', 'herbal'], description: 'Noble hop, floral doux, équilibré' },
  { name: 'Hallertau Blanc', origin: 'Allemagne', alphaAcid: { min: 9, max: 12 }, profile: ['vin blanc', 'fruits', 'floral'], description: 'Fruité, vin blanc, passion' },
  { name: 'Hallertau Tradition', origin: 'Allemagne', alphaAcid: { min: 5, max: 7 }, profile: ['floral', 'herbal', 'épicé'], description: 'Similaire au Mittelfrüh, plus résistant' },
  { name: 'Hersbrucker', origin: 'Allemagne', alphaAcid: { min: 2, max: 5 }, profile: ['floral', 'fruité', 'épicé'], description: 'Délicat, fruité, légèrement épicé' },
  { name: 'Perle', origin: 'Allemagne', alphaAcid: { min: 6, max: 9 }, profile: ['épicé', 'floral', 'menthe'], description: 'Dual purpose, épicé, légèrement mentholé' },
  { name: 'Tettnang', origin: 'Allemagne', alphaAcid: { min: 3.5, max: 5.5 }, profile: ['floral', 'épicé', 'herbal'], description: 'Noble hop, délicat, légèrement épicé' },
  { name: 'Spalt', origin: 'Allemagne', alphaAcid: { min: 4, max: 5.5 }, profile: ['épicé', 'herbal', 'boisé'], description: 'Noble hop, épicé, légèrement boisé' },
  { name: 'Northern Brewer', origin: 'Allemagne/UK', alphaAcid: { min: 7, max: 10 }, profile: ['boisé', 'menthe', 'herbal'], description: 'Dual purpose, boisé, mentholé' },
  { name: 'Challenger', origin: 'Angleterre', alphaAcid: { min: 6.5, max: 8.5 }, profile: ['épicé', 'cèdre', 'agrumes'], description: 'Anglais polyvalent, épicé, notes de cèdre' },
  { name: 'East Kent Goldings', origin: 'Angleterre', alphaAcid: { min: 4.5, max: 6.5 }, profile: ['floral', 'miel', 'épicé'], description: 'Classique anglais, floral, miel' },
  { name: 'Fuggle', origin: 'Angleterre', alphaAcid: { min: 4, max: 5.5 }, profile: ['boisé', 'terreux', 'herbal'], description: 'Anglais classique, boisé, terreux' },
  { name: 'Goldings', origin: 'Angleterre', alphaAcid: { min: 4, max: 6 }, profile: ['floral', 'miel', 'terreux'], description: 'Anglais traditionnel, doux, floral' },
  { name: 'Target', origin: 'Angleterre', alphaAcid: { min: 9.5, max: 12.5 }, profile: ['épicé', 'herbal', 'sauge'], description: 'Anglais amérisant, intense, épicé' },
  { name: 'First Gold', origin: 'Angleterre', alphaAcid: { min: 6.5, max: 8.5 }, profile: ['floral', 'épicé', 'orange'], description: 'Dual purpose anglais, notes d\'orange' },
  { name: 'Admiral', origin: 'Angleterre', alphaAcid: { min: 13, max: 16 }, profile: ['agrumes', 'herbal', 'résineux'], description: 'Amérisant anglais, agrumes, résineux' },
  { name: 'Bramling Cross', origin: 'Angleterre', alphaAcid: { min: 5, max: 7 }, profile: ['cassis', 'citron', 'épicé'], description: 'Fruité unique, cassis, citron' },
  { name: 'Progress', origin: 'Angleterre', alphaAcid: { min: 5, max: 7.5 }, profile: ['herbal', 'fruité', 'miel'], description: 'Alternative au Fuggle, plus doux' },
  { name: 'Pilgrim', origin: 'Angleterre', alphaAcid: { min: 9, max: 13 }, profile: ['agrumes', 'épicé', 'herbal'], description: 'Dual purpose, citron, épicé' },
  { name: 'Styrian Goldings', origin: 'Slovénie', alphaAcid: { min: 4.5, max: 6 }, profile: ['floral', 'épicé', 'terreux'], description: 'Délicat, épicé, polyvalent' },
  { name: 'Sorachi Ace', origin: 'Japon', alphaAcid: { min: 10, max: 14 }, profile: ['citron', 'herbes', 'noix de coco'], description: 'Unique, citron, herbes japonaises' },
  { name: 'Strisselspalt', origin: 'France', alphaAcid: { min: 3, max: 5 }, profile: ['floral', 'herbal', 'épicé'], description: 'Alsacien noble, délicat, floral' },
  { name: 'Aramis', origin: 'France', alphaAcid: { min: 7, max: 8.5 }, profile: ['herbal', 'épicé', 'floral'], description: 'Français polyvalent, herbal, épicé' },
  { name: 'Barbe Rouge', origin: 'France', alphaAcid: { min: 8, max: 9 }, profile: ['fruits rouges', 'fraise', 'floral'], description: 'Français fruité, fruits rouges unique' },
  { name: 'Bouclier', origin: 'France', alphaAcid: { min: 8, max: 11 }, profile: ['floral', 'fruité', 'épicé'], description: 'Français moderne, équilibré' },

  // Houblons néo-zélandais
  { name: 'Nelson Sauvin', origin: 'Nouvelle-Zélande', alphaAcid: { min: 12, max: 14 }, profile: ['vin blanc', 'groseille', 'tropical'], description: 'Unique, vin blanc, groseille' },
  { name: 'Motueka', origin: 'Nouvelle-Zélande', alphaAcid: { min: 6.5, max: 8.5 }, profile: ['citron', 'tropical', 'épicé'], description: 'Citron vert, tropical léger' },
  { name: 'Riwaka', origin: 'Nouvelle-Zélande', alphaAcid: { min: 4.5, max: 6.5 }, profile: ['passion', 'pamplemousse', 'tropical'], description: 'Fruit de la passion intense' },

  // Houblons d'amérisation
  { name: 'Magnum', origin: 'Allemagne', alphaAcid: { min: 11, max: 14 }, profile: ['neutre', 'propre'], description: 'Amérisant propre, neutre' },
  { name: 'Warrior', origin: 'USA', alphaAcid: { min: 15, max: 17 }, profile: ['neutre', 'légèrement résineux'], description: 'Amérisant propre, léger résineux' },
  { name: 'Bittering (générique)', origin: 'Divers', alphaAcid: { min: 8, max: 12 }, profile: ['neutre'], description: 'Houblon amérisant standard' },
];

// ========================================
// LEVURES
// ========================================

export interface YeastData {
  name: string;
  lab: string;
  code?: string;
  type: 'ale' | 'lager' | 'wheat' | 'belgian' | 'wild' | 'wine' | 'cider';
  form: 'liquid' | 'dry';
  attenuation: { min: number; max: number };
  tempRange: { min: number; max: number };
  flocculation: 'low' | 'medium' | 'high' | 'very-high';
  profile: string[];
  description?: string;
}

export const YEASTS_DATABASE: YeastData[] = [
  // Levures sèches Fermentis
  { name: 'Safale US-05', lab: 'Fermentis', type: 'ale', form: 'dry', attenuation: { min: 78, max: 82 }, tempRange: { min: 15, max: 24 }, flocculation: 'medium', profile: ['neutre', 'propre'], description: 'American Ale, propre et neutre' },
  { name: 'Safale S-04', lab: 'Fermentis', type: 'ale', form: 'dry', attenuation: { min: 73, max: 77 }, tempRange: { min: 15, max: 24 }, flocculation: 'high', profile: ['fruité', 'anglais'], description: 'English Ale, légèrement fruité' },
  { name: 'Safale S-33', lab: 'Fermentis', type: 'ale', form: 'dry', attenuation: { min: 68, max: 72 }, tempRange: { min: 15, max: 24 }, flocculation: 'medium', profile: ['fruité', 'épicé'], description: 'Ale polyvalente, notes fruitées' },
  { name: 'Safbrew T-58', lab: 'Fermentis', type: 'belgian', form: 'dry', attenuation: { min: 72, max: 78 }, tempRange: { min: 15, max: 24 }, flocculation: 'low', profile: ['épicé', 'poivré', 'fruité'], description: 'Belgian Ale, épicé et poivré' },
  { name: 'Safbrew BE-256', lab: 'Fermentis', type: 'belgian', form: 'dry', attenuation: { min: 82, max: 86 }, tempRange: { min: 15, max: 24 }, flocculation: 'high', profile: ['fruité', 'épicé', 'alcool'], description: 'Abbaye, haute atténuation' },
  { name: 'Safbrew WB-06', lab: 'Fermentis', type: 'wheat', form: 'dry', attenuation: { min: 86, max: 90 }, tempRange: { min: 18, max: 24 }, flocculation: 'low', profile: ['banane', 'clou de girofle'], description: 'Weizen, banane et clou de girofle' },
  { name: 'Saflager S-23', lab: 'Fermentis', type: 'lager', form: 'dry', attenuation: { min: 80, max: 84 }, tempRange: { min: 9, max: 15 }, flocculation: 'high', profile: ['propre', 'malté'], description: 'Lager européenne, propre' },
  { name: 'Saflager W-34/70', lab: 'Fermentis', type: 'lager', form: 'dry', attenuation: { min: 80, max: 84 }, tempRange: { min: 9, max: 15 }, flocculation: 'high', profile: ['propre', 'neutre'], description: 'Lager classique Weihenstephan' },

  // Levures sèches Lallemand
  { name: 'BRY-97', lab: 'Lallemand', type: 'ale', form: 'dry', attenuation: { min: 74, max: 78 }, tempRange: { min: 15, max: 22 }, flocculation: 'high', profile: ['neutre', 'propre'], description: 'American West Coast Ale' },
  { name: 'Nottingham', lab: 'Lallemand', type: 'ale', form: 'dry', attenuation: { min: 77, max: 82 }, tempRange: { min: 10, max: 22 }, flocculation: 'very-high', profile: ['neutre', 'propre'], description: 'Polyvalente, très floculante' },
  { name: 'London ESB', lab: 'Lallemand', type: 'ale', form: 'dry', attenuation: { min: 70, max: 75 }, tempRange: { min: 15, max: 22 }, flocculation: 'high', profile: ['fruité', 'malté'], description: 'English Ale, fruité, corsé' },
  { name: 'Belle Saison', lab: 'Lallemand', type: 'belgian', form: 'dry', attenuation: { min: 85, max: 92 }, tempRange: { min: 15, max: 35 }, flocculation: 'low', profile: ['fruité', 'épicé', 'sec'], description: 'Saison, très atténuante' },
  { name: 'Abbaye', lab: 'Lallemand', type: 'belgian', form: 'dry', attenuation: { min: 78, max: 85 }, tempRange: { min: 17, max: 25 }, flocculation: 'medium', profile: ['fruité', 'épicé', 'banane'], description: 'Belgian Abbey, esters fruités' },
  { name: 'Voss Kveik', lab: 'Lallemand', type: 'ale', form: 'dry', attenuation: { min: 75, max: 82 }, tempRange: { min: 25, max: 40 }, flocculation: 'high', profile: ['orange', 'tropical'], description: 'Kveik norvégien, fermentation rapide à haute température' },
  { name: 'Diamond Lager', lab: 'Lallemand', type: 'lager', form: 'dry', attenuation: { min: 77, max: 83 }, tempRange: { min: 10, max: 15 }, flocculation: 'high', profile: ['propre', 'neutre'], description: 'Lager européenne classique' },

  // Levures sèches Mangrove Jack's
  { name: 'M44 US West Coast', lab: "Mangrove Jack's", type: 'ale', form: 'dry', attenuation: { min: 78, max: 82 }, tempRange: { min: 16, max: 22 }, flocculation: 'high', profile: ['neutre', 'propre'], description: 'IPA américaine, neutre' },
  { name: 'M36 Liberty Bell', lab: "Mangrove Jack's", type: 'ale', form: 'dry', attenuation: { min: 74, max: 78 }, tempRange: { min: 16, max: 22 }, flocculation: 'medium', profile: ['fruité', 'épicé'], description: 'American Ale fruitée' },
  { name: 'M29 French Saison', lab: "Mangrove Jack's", type: 'belgian', form: 'dry', attenuation: { min: 85, max: 92 }, tempRange: { min: 26, max: 32 }, flocculation: 'low', profile: ['fruité', 'épicé', 'poivré'], description: 'Saison française, sèche et épicée' },
  { name: 'M21 Belgian Wit', lab: "Mangrove Jack's", type: 'wheat', form: 'dry', attenuation: { min: 72, max: 78 }, tempRange: { min: 18, max: 25 }, flocculation: 'low', profile: ['fruité', 'épicé', 'acidulé'], description: 'Witbier, légèrement acidulée' },
  { name: 'M41 Belgian Ale', lab: "Mangrove Jack's", type: 'belgian', form: 'dry', attenuation: { min: 82, max: 88 }, tempRange: { min: 18, max: 28 }, flocculation: 'medium', profile: ['fruité', 'épicé', 'banane'], description: 'Belgian Ale polyvalente' },

  // Levures liquides White Labs
  { name: 'WLP001 California Ale', lab: 'White Labs', type: 'ale', form: 'liquid', attenuation: { min: 73, max: 80 }, tempRange: { min: 20, max: 23 }, flocculation: 'medium', profile: ['neutre', 'propre'], description: 'American Ale classique' },
  { name: 'WLP002 English Ale', lab: 'White Labs', type: 'ale', form: 'liquid', attenuation: { min: 63, max: 70 }, tempRange: { min: 18, max: 21 }, flocculation: 'very-high', profile: ['fruité', 'malté'], description: 'English Ale, corps résiduel' },
  { name: 'WLP500 Monastery Ale', lab: 'White Labs', type: 'belgian', form: 'liquid', attenuation: { min: 75, max: 80 }, tempRange: { min: 18, max: 24 }, flocculation: 'medium', profile: ['fruité', 'épicé', 'clou de girofle'], description: 'Trappiste, complexe' },
  { name: 'WLP530 Abbey Ale', lab: 'White Labs', type: 'belgian', form: 'liquid', attenuation: { min: 75, max: 80 }, tempRange: { min: 18, max: 24 }, flocculation: 'high', profile: ['fruité', 'banane', 'pruneaux'], description: 'Abbey belge, fruité' },

  // Levures liquides Wyeast
  { name: '1056 American Ale', lab: 'Wyeast', type: 'ale', form: 'liquid', attenuation: { min: 73, max: 77 }, tempRange: { min: 15, max: 22 }, flocculation: 'medium', profile: ['neutre', 'propre'], description: 'Chico strain, polyvalente' },
  { name: '1098 British Ale', lab: 'Wyeast', type: 'ale', form: 'liquid', attenuation: { min: 73, max: 75 }, tempRange: { min: 18, max: 22 }, flocculation: 'medium', profile: ['fruité', 'complexe'], description: 'Whitbread, fruitée' },
  { name: '3068 Weihenstephan Weizen', lab: 'Wyeast', type: 'wheat', form: 'liquid', attenuation: { min: 73, max: 77 }, tempRange: { min: 18, max: 24 }, flocculation: 'low', profile: ['banane', 'clou de girofle'], description: 'Hefeweizen authentique' },
  { name: '3787 Trappist High Gravity', lab: 'Wyeast', type: 'belgian', form: 'liquid', attenuation: { min: 74, max: 78 }, tempRange: { min: 18, max: 25 }, flocculation: 'medium', profile: ['fruité', 'phénolique'], description: 'Westmalle, complexe' },
];

// ========================================
// FONCTIONS UTILITAIRES
// ========================================

/**
 * Recherche des malts par nom (fuzzy search)
 */
export function searchMalts(query: string): MaltData[] {
  const lowerQuery = query.toLowerCase();
  return MALTS_DATABASE.filter(malt =>
    malt.name.toLowerCase().includes(lowerQuery) ||
    malt.category.toLowerCase().includes(lowerQuery) ||
    malt.description?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Recherche des houblons par nom ou profil
 */
export function searchHops(query: string): HopData[] {
  const lowerQuery = query.toLowerCase();
  return HOPS_DATABASE.filter(hop =>
    hop.name.toLowerCase().includes(lowerQuery) ||
    hop.origin.toLowerCase().includes(lowerQuery) ||
    hop.profile.some(p => p.toLowerCase().includes(lowerQuery)) ||
    hop.description?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Recherche des levures par nom, lab ou profil
 */
export function searchYeasts(query: string): YeastData[] {
  const lowerQuery = query.toLowerCase();
  return YEASTS_DATABASE.filter(yeast =>
    yeast.name.toLowerCase().includes(lowerQuery) ||
    yeast.lab.toLowerCase().includes(lowerQuery) ||
    yeast.type.toLowerCase().includes(lowerQuery) ||
    yeast.profile.some(p => p.toLowerCase().includes(lowerQuery)) ||
    yeast.description?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Retourne l'alpha acide moyen d'un houblon
 */
export function getAverageAlphaAcid(hop: HopData): number {
  return (hop.alphaAcid.min + hop.alphaAcid.max) / 2;
}

/**
 * Retourne l'atténuation moyenne d'une levure
 */
export function getAverageAttenuation(yeast: YeastData): number {
  return (yeast.attenuation.min + yeast.attenuation.max) / 2;
}

/**
 * Retourne la température moyenne de fermentation
 */
export function getAverageTemp(yeast: YeastData): number {
  return (yeast.tempRange.min + yeast.tempRange.max) / 2;
}
