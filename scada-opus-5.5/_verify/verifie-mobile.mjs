import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import zlib from 'node:zlib';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

/* Banc d'essai d'acceptation MOBILE de la page hakko-dashboard.html.
   Il ne modifie jamais la page : il la charge dans un navigateur jetable (Edge, profil
   vide), la mesure à dix gabarits d'écran et sur neuf pages, puis conclut assertion par
   assertion. C'est la mise en œuvre mesurable de _verify/spec-acceptation.md : chaque
   assertion porte le numéro du critère qu'elle vérifie, et aucun seuil n'est inventé ici.

   Les dix gabarits (tableau « Gabarits » de la spécification) :
     É1  430 × 932   étroit   iPhone 15 Pro Max portrait, référence
     É2  430 × 600   étroit   même largeur, petite hauteur (clavier)
     É3  390 × 844   étroit   iPhone 15
     É4  360 × 740   étroit   Android étroit
     É5  852 × 393   étroit   téléphone en paysage (≤ 900 px)
     F1 1440 × 900   forcé    vue forcée par clic réel puis par script
     F2 1440 × 700   forcé    vue forcée, autre hauteur
     B1 1280 × 720   bureau
     B2 1440 × 900   bureau
     B3 1600 × 900   bureau
   Les dix états de page : P1 #/ · P2 #/appareils (Tous) · P3 #/appareils (Prises) ·
   P4 #/f/b1 (onglets Température et Densité) · P5 #/f/b3 · P6 #/recettes ·
   P7 #/recettes/r1 · P8 #/archive · P9 #/archive/b0 (P4b = P4 onglet Densité).

   Ce qui est mesuré, critère par critère :
     1. débordement horizontal du document (html et body) nul ;
     2. aucun élément visible hors du cadre horizontal — sont écartés les éléments de
        taille nulle ou invisibles, les éléments en position fixed, les descendants d'un
        conteneur qui défile latéralement, et ceux qu'un ancêtre découpe (overflow
        hidden) car ceux-là ne sont pas visibles ;
     3. débordement masqué : scrollWidth − clientWidth ≤ 1 px pour chaque .card,
        .scroll-card, .lots et .home-grid > * (le défaut que 1 et 2 ne voient pas) ;
        seules exceptions permises : .tabs, et .tbl-wrap / .grav-list à É4 ;
     4. onglets de filtre : pas de débordement à É1, les 4 onglets dans la boîte de
        .tabs et hauts d'au moins 44 px ; à É3 et É4 : .tabs dans sa carte, overflow-x
        auto, onglet actif souligné de la couleur de --accent ;
     5. barre d'onglets basse : flex, 4 liens « Accueil, Archive, Recettes, Appareils »,
        64 ± 1 px de haut, collée au bas de la fenêtre, liens ≥ 44 × 44 ;
     6. colonne latérale masquée (.side) ;
     7. vue d'ensemble à une seule colonne (.home-grid), lots ≥ 370 px à É1 ;
     8. interrupteur des prises : 56 × 32 px, ::after 28 × 28, translation 24 px,
        zone tactile 56 × 44 par ::before en position:absolute ;
     9. écart ≥ 8 px entre la zone tactile de l'interrupteur et celle du bouton de
        suppression voisin ;
    10. cibles tactiles ≥ 44 × 44 px sur toutes les pages (relevé de contrôle imprimé) ;
    11. champs à 16 px minimum, consigne .stepper à 18 px ;
    12. journal du lot : .jt ≥ 250 px, bord droit aligné sur l'intérieur du li ;
    13. indépendance de la hauteur : .dp identique entre É1 et É2, display ≠ flex,
        .dp-chart 380 px, .dp-journal 420 px, .arch-2 320 px ;
    14. à É1 à É5 : <html> porte tactile, pas vue-tel, #vueBtn masqué ;
    15. formulaire de recette intact : pistes .rrow.step et .rrow ;
    16. vue forcée par clic réel : classes posées et #vueBtn aria-pressed="true" ;
    17. cadre de 430 px centré (bord gauche 505 px à 1440 px) et #tabbar dans le cadre ;
    18. équivalence F1 ⇄ É1, sélecteur par sélecteur, de la liste du critère 18 ;
    19. en vue forcée, les critères 1, 2, 3, 5, 6, 7, 8, 9, 10, 11 et 12 tiennent ;
    20. verrou de hauteur neutralisé : .dp identique entre F1 et F2, padding du .content
        à 20 / 84 px sur P4 et P9 ;
    21. bouton de vue enfoncé : 34 × 34 px visibles, zone tactile ≥ 44 × 44, fond
        --accent-soft ;
    22. aller-retour du bouton sans résidu : écart géométrique nul et graphiques
        redessinés dans les 500 ms ;
    23. persistance : classe vue-tel présente dès le premier rAF, clé retirée à la sortie ;
    24. logique des prises unique : 0 requête api/prise, 1 navigation, même regulId ;
    25. zéro erreur console, zéro requête échouée (favicon et polices Google exclus) ;
    26. bureau : aucune classe, #vueBtn visible 34 × 34, aria-pressed="false" ;
    27. interrupteur de souris : 36 × 20, ::before sans contenu, ::after 16 × 16 ;
    28. champs et boutons de bureau, pistes de .home-grid (300 px à B1, 340 px à B2/B3) ;
    29. écart géométrique nul avant/après correctif sur P1 à P9 à B1, B2 et B3 ;
    30. pixels identiques (rectangle de .top-right masqué) aux mêmes endroits ; les
        animations CSS sont remises au temps 0 et les minuteries de la page arrêtées des
        deux côtés avant la capture, sinon le clignotement du point « en direct » et le
        battement de trois secondes suffisent à faire différer des pixels ;
    31 à 34 : relevés manuels sur l'iPhone réel, hors de portée d'un banc headless : ils
        ne sont pas testés ici (aucune assertion ne les concerne).

   Usage :
     node verifie-mobile.mjs [url] [options]
       url                     page à mesurer (défaut : le fichier local,
                               file:///…/MyFermentLab/scada-opus-5.5/hakko-dashboard.html)
       --sabotage              contrôle négatif : retire UNE seule règle CSS de la copie
                               temporaire de la page (celle qui masque la colonne latérale)
                               et exige que l'assertion correspondante échoue. Le script
                               sort alors en erreur (code 1) ; si tout passait malgré la
                               règle retirée, il sortirait en 2.
       --reference <f.html>    mesure une AUTRE copie de la page (la version « avant
                               correctif ») sous les mêmes conditions figées, et compare
                               aux gabarits de bureau B1, B2 et B3 : écart géométrique
                               élément par élément (critère 29) et pixels pleine page
                               avec le rectangle de .top-right masqué (critère 30).
       --ecrire-reference [chemin]
                               recopie la page mesurée dans le dossier temporaire (ou vers
                               « chemin ») et affiche le chemin obtenu : c'est le fichier
                               de référence à passer ensuite à --reference.
                               Exemple, page avant correctif puis page après :
                                 cp hakko-dashboard.html /tmp/avant.html
                                 node verifie-mobile.mjs file:///…/avant.html --ecrire-reference
                                 node verifie-mobile.mjs --reference <chemin affiché>
       --sans-pixels           désactive la comparaison de pixels (critère 30), plus rapide.
       --gabarits=É1,B2        ne mesure que ces gabarits (codes de la spécification).
       --pages=P1,P4,P9        ne mesure que ces pages.
       --aide                  affiche cette aide.

   Conditions de mesure : profil vierge (localStorage vide), page servie en file://,
   barres de défilement masquées (--hide-scrollbars), Date.now figé à 1790150400000
   (23/09/2026, 10 h 00) et Math.random remplacé par une suite déterministe, injectés
   avant tout script de la page. Tolérances : ±0,5 px pour une taille, ±1 px pour une
   position, sauf mention contraire du critère.

   Code de sortie : 0 seulement si toutes les assertions passent, 1 sinon (2 en sabotage
   si la régression n'a pas été détectée, 3 en cas d'erreur d'usage). Aucune capture
   n'est conservée, sauf les images temporaires des comparaisons de pixels, écrites dans
   le dossier temporaire et effacées en fin de course. */

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PAGE_DEFAUT = 'C:/Users/Timothée/Documents/IA/Hermes/MyFermentLab/scada-opus-5.5/hakko-dashboard.html';

/* Temps et hasard figés (conditions de mesure communes de la spécification). */
const HORLOGE_FIGEE = 1790150400000;
const GRAINE = 0xC0FFEE;

/* Les dix gabarits. « poids » fixe l'ordre de passage : étroits, puis bureaux, puis vue
   forcée — la vue forcée se compare à É1 et à B2, qui doivent donc être mesurés avant. */
const GABARITS = [
  { code: 'É1', l: 430,  h: 932, regime: 'etroit', poids: 1, nom: 'iPhone 15 Pro Max portrait (référence)' },
  { code: 'É2', l: 430,  h: 600, regime: 'etroit', poids: 1, nom: 'même largeur, petite hauteur (clavier)' },
  { code: 'É3', l: 390,  h: 844, regime: 'etroit', poids: 1, nom: 'iPhone 15' },
  { code: 'É4', l: 360,  h: 740, regime: 'etroit', poids: 1, nom: 'Android étroit' },
  { code: 'É5', l: 852,  h: 393, regime: 'etroit', poids: 1, nom: 'téléphone en paysage (≤ 900 px)' },
  { code: 'F1', l: 1440, h: 900, regime: 'force',  poids: 3, nom: 'vue forcée, 1440 × 900' },
  { code: 'F2', l: 1440, h: 700, regime: 'force',  poids: 3, nom: 'vue forcée, 1440 × 700' },
  { code: 'B1', l: 1280, h: 720, regime: 'bureau', poids: 2, nom: 'bureau 1280 × 720' },
  { code: 'B2', l: 1440, h: 900, regime: 'bureau', poids: 2, nom: 'bureau 1440 × 900' },
  { code: 'B3', l: 1600, h: 900, regime: 'bureau', poids: 2, nom: 'bureau 1600 × 900' },
];

/* Les pages, avec les clics nécessaires pour atteindre l'état demandé par la
   spécification (filtre d'appareils, onglet de graphique). */
const PAGES = [
  { code: 'P1', nom: 'Vue d’ensemble',        hash: '#/',             clics: [] },
  { code: 'P2', nom: 'Appareils — Tous',      hash: '#/appareils',    clics: ['[data-action="dfilter"][data-v="all"]'] },
  { code: 'P3', nom: 'Appareils — Prises',    hash: '#/appareils',    clics: ['[data-action="dfilter"][data-v="plug"]'] },
  { code: 'P4', nom: 'Lot b1 — Température',  hash: '#/f/b1',         clics: ['[data-action="ctab"][data-v="temp"]'] },
  { code: 'P4b', nom: 'Lot b1 — Densité',     hash: '#/f/b1',         clics: ['[data-action="ctab"][data-v="grav"]'] },
  { code: 'P5', nom: 'Lot b3',                hash: '#/f/b3',         clics: [] },
  { code: 'P6', nom: 'Recettes',              hash: '#/recettes',     clics: [] },
  { code: 'P7', nom: 'Recette r1',            hash: '#/recettes/r1',  clics: [] },
  { code: 'P8', nom: 'Archive',               hash: '#/archive',      clics: [] },
  { code: 'P9', nom: 'Archive b0',            hash: '#/archive/b0',   clics: [] },
];

/* Sélecteurs du critère 18 : largeur, hauteur et position relative au cadre doivent
   coïncider entre F1 et É1. */
const SELECTEURS_18 = ['.content', '.home-grid > *', '.kpis .kpi', '.lot', '.tabs',
  '.tabs > button', '.switch', '.outlet', '.dp-chart', '.dp-journal', '.dp-side',
  '#journal-list li.jl .jt', '.rrow', '.grav-side .grav-form', '#tabbar a'];

/* Sélecteurs du critère 10 (cibles tactiles). */
const SEL_CIBLES = 'a[href], button, select, input:not([type=radio]):not([type=hidden]), textarea, [role=tab]';

const CHAMP_MINI_PX = 16;                       // champs sans zoom (critère 11)
const CONSEIL_PX = 18;                          // .stepper input (critère 11)

/* ---------- Comptage et affichage ---------- */
let ok = 0, ko = 0;
const koParCategorie = new Map();               // sert au contrôle négatif en fin de course
const nombre = v => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));

const ligne = (bon, categorie, nom, obtenu, attendu) => {
  console.log(`  ${bon ? 'OK  ' : 'KO  '} ${nom.padEnd(54)} ${String(obtenu).padEnd(20)} attendu : ${attendu}`);
  if (bon) ok++;
  else { ko++; koParCategorie.set(categorie, (koParCategorie.get(categorie) || 0) + 1); }
  return bon;
};
// Les formes de comparaison, jamais sans afficher les deux côtés.
const controle = (cat, nom, attendu, obtenu) => ligne(String(attendu) === String(obtenu), cat, nom, obtenu, attendu);
const auPlus   = (cat, nom, seuil, mesure, unite = 'px') => ligne(mesure <= seuil, cat, nom, `${nombre(mesure)} ${unite}`, `au plus ${seuil} ${unite}`);
const auMoins  = (cat, nom, seuil, mesure, unite = 'px') => ligne(mesure >= seuil, cat, nom, `${nombre(mesure)} ${unite}`, `au moins ${seuil} ${unite}`);
const egalA    = (cat, nom, attendu, mesure, tolerance, unite = 'px') =>
  ligne(Math.abs(mesure - attendu) <= tolerance, cat, nom, `${nombre(mesure)} ${unite}`, `${nombre(attendu)} ${unite} (±${tolerance})`);
const info = (nom, valeur) => console.log(`  ··  ${nom.padEnd(54)} ${valeur}`);
const titre = t => console.log('\n' + t);
const attendre = ms => new Promise(r => setTimeout(r, ms));
const court = l => String(l || '').replace(/\s+/g, ' ').slice(0, 44);

/* ---------- Arguments ---------- */
const args = process.argv.slice(2);
const options = { sabotage: false, sansPixels: false, reference: null, ecrireReference: null,
  gabarits: null, pages: null, aide: false };
let urlFournie = null;
const usageErreur = (message) => { console.log(`  KO  ${message}`); process.exit(3); };

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const suite = () => (args[i + 1] && !args[i + 1].startsWith('--')) ? args[++i] : '';
  if (a === '--aide' || a === '-h' || a === '--help') { options.aide = true; continue; }
  if (a === '--sabotage') { options.sabotage = true; continue; }
  if (a === '--sans-pixels') { options.sansPixels = true; continue; }
  if (a === '--reference') { options.reference = suite(); continue; }
  if (a.startsWith('--reference=')) { options.reference = a.slice('--reference='.length); continue; }
  if (a === '--ecrire-reference') { options.ecrireReference = suite(); continue; }
  if (a.startsWith('--ecrire-reference=')) { options.ecrireReference = a.slice('--ecrire-reference='.length); continue; }
  if (a === '--gabarits') { options.gabarits = suite(); continue; }
  if (a.startsWith('--gabarits=')) { options.gabarits = a.slice('--gabarits='.length); continue; }
  if (a === '--pages') { options.pages = suite(); continue; }
  if (a.startsWith('--pages=')) { options.pages = a.slice('--pages='.length); continue; }
  if (a.startsWith('--')) usageErreur(`option inconnue : ${a}`);
  if (!urlFournie) urlFournie = a;
}
if (options.reference === '') usageErreur('--reference attend un chemin de fichier.');
if (options.aide) {
  const source = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  console.log(source.slice(source.indexOf('/*'), source.indexOf('*/') + 2));
  process.exit(0);
}

const sabotage = options.sabotage;
const cible = urlFournie || pathToFileURL(PAGE_DEFAUT).href;
/* Les listes reçues contiennent les codes accentués (É1) : on les garde tels quels. */
const listeFiltres = v => v == null ? null : v.split(',').map(s => s.trim()).filter(Boolean);
const filtreGabarits = listeFiltres(options.gabarits);
const filtrePages = listeFiltres(options.pages);
const gabaritsRetenus = GABARITS.filter(g => !filtreGabarits || filtreGabarits.includes(g.code));
const pagesRetenues = PAGES.filter(p => !filtrePages || filtrePages.includes(p.code));
if (!gabaritsRetenus.length) usageErreur('--gabarits ne retient aucun gabarit connu.');
if (!pagesRetenues.length) usageErreur('--pages ne retient aucune page connue.');

/* ---------- Contrôle négatif : trouver la règle qui masque la colonne latérale ---------- */
/* On ne touche pas à la page d'origine : la variante est écrite dans une copie temporaire
   du dossier système. Une règle = un bloc « sélecteur { … } » repéré textuellement dans le
   fichier ; le sélecteur doit viser la classe .side (et non .side-stack, .side-foot…) et le
   bloc doit poser display:none. */
const reglesQuiMasquentLaLaterale = (source) => {
  const trouvees = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const selecteur = m[1].trim().replace(/\s+/g, ' ');
    const corps = m[2];
    if (!/\.side(?![-_a-zA-Z0-9])/.test(selecteur)) continue;
    if (!/display\s*:\s*none/i.test(corps)) continue;
    // Numéro de ligne du premier caractère du sélecteur (m[1] commence après l'accolade
    // fermante de la règle précédente, espaces et sauts de ligne compris).
    const debutUtile = m.index + (m[1].length - m[1].trimStart().length);
    trouvees.push({
      debut: m.index,
      fin: m.index + m[0].length,
      texte: `${selecteur}{${corps.trim().replace(/\s+/g, ' ')}}`,
      ligne: source.slice(0, debutUtile).split('\n').length,
    });
  }
  return trouvees;
};

/* ---------- Navigateur ---------- */
const b = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'shell',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
});
const p = await b.newPage();
p.setDefaultTimeout(20000);

// Temps et hasard figés avant tout script de la page (conditions de mesure communes).
await p.evaluateOnNewDocument((horloge, graine) => {
  Date.now = () => horloge;
  let etat = graine >>> 0;
  Math.random = () => { etat = (etat * 1664525 + 1013904223) >>> 0; return etat / 4294967296; };
  window.__premiereImage = null;
  requestAnimationFrame(() => { window.__premiereImage = document.documentElement.className; });
  /* Témoin d'instance (critère 24) : incrémenté à chaque chargement de page, jamais
     ailleurs. S'il vaut encore la même chose après les bascules, la page n'a pas été
     rechargée. */
  window.__chargements = (window.__chargements || 0) + 1;
}, HORLOGE_FIGEE, GRAINE);

// Une erreur console n'est retenue que si elle concerne la page : le favicon et les polices
// Google (chargées depuis Internet) sont hors sujet, comme dans verif-auto.mjs.
const horsSujet = s => /favicon|fonts\.(googleapis|gstatic)/.test(s);
let erreurs = [];
let requetesPrise = 0;                          // compteur pour le critère 24
let urlChargee = null;                          // page actuellement chargée dans l'onglet
p.on('pageerror', e => erreurs.push('pageerror : ' + e.message));
p.on('console', m => {
  if (m.type() !== 'error') return;
  const t = m.text(), u = (m.location() && m.location().url) || '';
  if (horsSujet(t) || horsSujet(u)) return;
  erreurs.push(`console : ${t}${u ? ' — ' + u : ''}`);
});
p.on('requestfailed', r => {
  if (horsSujet(r.url())) return;
  erreurs.push('requête échouée : ' + r.url());
});
p.on('request', r => { if (/api\/prise/.test(r.url())) requetesPrise++; });

console.log('=== Banc d’essai MOBILE — hakko-dashboard.html ===');
info('page mesurée', cible);
info('gabarits mesurés', gabaritsRetenus.map(g => `${g.code} ${g.l}×${g.h}`).join(', '));
info('pages mesurées', pagesRetenues.map(x => x.code).join(', '));
info('référence', options.reference ? options.reference : 'aucune (critères 29 et 30 non mesurés)');
info('mode', sabotage ? 'CONTRÔLE NÉGATIF (--sabotage)' : 'mesure normale');

/* ---------- Contrôle négatif : fabrication de la copie temporaire sabotée ---------- */
let cibleMesuree = cible;
let negatif = null;

const colonneLateraleVisible = async () => p.evaluate(() => {
  const e = document.querySelector('.side');
  if (!e) return false;
  const cs = getComputedStyle(e), r = e.getBoundingClientRect();
  return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 1 && r.height > 1;
});

if (sabotage) {
  titre('=== Préparation du contrôle négatif (--sabotage) ===');
  if (!cible.startsWith('file:')) {
    console.log('  KO  --sabotage exige un fichier local (url file://…) : rien à modifier ici.');
    await b.close();
    process.exit(2);
  }
  const fichierSource = fileURLToPath(cible);
  const source = fs.readFileSync(fichierSource, 'utf8');
  const candidates = reglesQuiMasquentLaLaterale(source);
  info('règles candidates trouvées', String(candidates.length));
  candidates.forEach(c => info(`  ligne ${c.ligne}`, c.texte));

  if (!candidates.length) {
    console.log('  KO  aucune règle ne masque .side : le contrôle négatif est impossible.');
    await b.close();
    process.exit(2);
  }

  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'verif-mobile-'));
  const fichierSabote = path.join(dossier, 'hakko-dashboard-sabotage.html');
  const urlSabotage = pathToFileURL(fichierSabote).href;

  await p.setViewport({ width: 430, height: 932, deviceScaleFactor: 1 });
  for (const c of candidates) {
    fs.writeFileSync(fichierSabote, source.slice(0, c.debut) + source.slice(c.fin), 'utf8');
    await p.goto(urlSabotage, { waitUntil: 'domcontentloaded' });
    await attendre(700);
    const visible = await colonneLateraleVisible();
    info(`essai : règle ligne ${c.ligne} retirée seule`, visible ? 'la colonne latérale réapparaît → règle retenue' : 'la colonne latérale reste masquée');
    if (visible) { negatif = { ...c, fichier: fichierSabote, dossier }; break; }
  }
  if (!negatif) {
    // Aucune règle ne suffit seule (masquage par un autre moyen) : on sabote la première
    // candidate quand même, la suite dira si la régression est détectée.
    const c = candidates[0];
    fs.writeFileSync(fichierSabote, source.slice(0, c.debut) + source.slice(c.fin), 'utf8');
    negatif = { ...c, fichier: fichierSabote, dossier };
    info('avertissement', 'aucune règle isolée ne suffit : c’est la première candidate qui est retirée');
  }
  cibleMesuree = urlSabotage;
  info('copie temporaire', negatif.fichier);
  info('règle retirée', `ligne ${negatif.ligne} — ${negatif.texte}`);
  erreurs = [];   // les chargements de préparation ne comptent pas dans les relevés
}

/* ---------- Copie de référence (critères 29 et 30) ---------- */
let urlReference = null;
if (options.reference) {
  const cheminRef = path.resolve(options.reference);
  if (!fs.existsSync(cheminRef)) usageErreur(`--reference : fichier introuvable (${cheminRef})`);
  urlReference = pathToFileURL(cheminRef).href;
}
if (options.ecrireReference != null) {
  if (!cible.startsWith('file:')) usageErreur('--ecrire-reference exige une page locale (url file://…).');
  const destination = options.ecrireReference
    ? path.resolve(options.ecrireReference)
    : path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'verif-mobile-ref-')), 'reference-hakko-dashboard.html');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(fileURLToPath(cible), destination);
  titre('=== Fichier de référence écrit (--ecrire-reference) ===');
  info('copie de la page mesurée', destination);
  info('usage', `node ${path.basename(fileURLToPath(import.meta.url))} --reference "${destination}"`);
}

/* ---------- Dossier des images de comparaison (critère 30) ---------- */
const dossierPixels = fs.mkdtempSync(path.join(os.tmpdir(), 'verif-mobile-pixels-'));

/* ---------- Contrôle 5 : marqueur de version ---------- */
/* Conservé tel quel depuis le banc d'origine : ni data-version ni window.HAKKO_VERSION
   n'existent dans le fichier, ces deux assertions échouent donc indépendamment du
   correctif mobile. Elles ne sont pas retirées pour autant : c'est le seul contrôle qui
   traçait la version de la page. */
titre('=== Marqueur de version ===');
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await p.goto(cibleMesuree, { waitUntil: 'domcontentloaded' });
await attendre(900);
const version = await p.evaluate(() => {
  const el = document.querySelector('[data-version]');
  const cl = (el && el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
  return {
    attribut: el ? el.getAttribute('data-version') : null,
    porteur: el ? el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cl ? '.' + cl : '') : null,
    variable: typeof window.HAKKO_VERSION !== 'undefined' ? String(window.HAKKO_VERSION) : null,
  };
});
info('balise viewport', await p.evaluate(() => {
  const m = document.querySelector('meta[name="viewport"]');
  return m ? m.getAttribute('content') : 'ABSENTE (layout 980 px sur téléphone)';
}));
/* Correction : l'assertion d'origine comparait le littéral 'présent' à la VALEUR de
   l'attribut, donc elle échouait dès que la page portait un marqueur. L'intention est bien
   la présence de l'attribut, pas sa valeur (imprimée juste après). */
controle('version', 'attribut data-version présent', 'présent', version.attribut ? 'présent' : 'absent');
info('  valeur de data-version', version.attribut ?? '—');
info('  porteur de l’attribut', version.porteur ?? '—');
controle('version', 'window.HAKKO_VERSION défini', 'défini', typeof version.variable === 'string' ? 'défini' : 'absent');
info('  valeur de window.HAKKO_VERSION', version.variable ?? '—');
if (version.attribut && version.variable) {
  info('  accord des deux marqueurs', version.attribut === version.variable ? 'identiques' : 'DIFFÉRENTS (à vérifier)');
}
urlChargee = null;   // la boucle principale rechargera la page pour son propre compte
/* ---------- Relevé complet d'une vue ---------- */
/* Une seule évaluation par page : tout ce que les critères demandent est mesuré ici, et
   rien n'est jugé côté page (les seuils restent dans Node, affichés par les assertions). */
const releve = (opt = {}) => p.evaluate((opt) => {
  const racine = document.documentElement;
  const num = v => { const f = parseFloat(v); return isFinite(f) ? f : 0; };
  const arrondi = v => Math.round(v * 2) / 2;          // arrondi au ½ px (critère 29)
  const court1 = v => Math.round(v * 10) / 10;         // 0,1 px, pour l'affichage

  const nomCourt = e => {
    let s = e.tagName.toLowerCase();
    if (e.id) s += '#' + e.id;
    const cl = (e.getAttribute && e.getAttribute('class')) || '';
    if (cl) s += '.' + cl.trim().split(/\s+/).slice(0, 3).join('.');
    return s;
  };
  const texte = (e, n = 34) => (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, n);

  // Valeur calculée d'une propriété personnalisée (--accent devient rgb(…)).
  const couleur = v => {
    const s = document.createElement('span');
    s.style.cssText = 'display:none';
    s.style.color = v;
    document.body.appendChild(s);
    const c = getComputedStyle(s).color;
    s.remove();
    return c;
  };

  const estVisible = e => {
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    return r.width > 0.5 && r.height > 0.5 && cs.display !== 'none'
      && cs.visibility !== 'hidden' && parseFloat(cs.opacity || '1') > 0;
  };

  /* Zone tactile (critères 8, 10, 21) : union de la boîte et de la boîte du ::before
     quand celui-ci est position:absolute — même calcul que le banc d'origine. */
  const zoneTactile = e => {
    const r = e.getBoundingClientRect();
    const p = getComputedStyle(e, '::before');
    let g = r.left, t = r.top, d = r.right, bas = r.bottom;
    const w = num(p.width), h = num(p.height);
    const aContenu = p.content && p.content !== 'none' && p.content !== 'normal';
    if (p.position === 'absolute' && aContenu && w > 0 && h > 0) {
      const auto = v => v === 'auto' || v === '' || v == null;
      const x0 = !auto(p.left) ? num(p.left) : !auto(p.right) ? r.width - num(p.right) - w : (r.width - w) / 2;
      const y0 = !auto(p.top) ? num(p.top) : !auto(p.bottom) ? r.height - num(p.bottom) - h : (r.height - h) / 2;
      g = Math.min(g, r.left + x0); d = Math.max(d, r.left + x0 + w);
      t = Math.min(t, r.top + y0); bas = Math.max(bas, r.top + y0 + h);
    }
    return { g: court1(g), t: court1(t), d: court1(d), bas: court1(bas), l: court1(d - g), h: court1(bas - t) };
  };

  const estFixe = e => {
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
      if (getComputedStyle(n).position === 'fixed') return true;
    }
    return false;
  };
  // Descendant d'un conteneur qui défile latéralement : son débordement est voulu.
  const sousDefilementLateral = e => {
    for (let n = e.parentElement; n && n !== racine; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true;
    }
    return false;
  };
  // Découpé par un ancêtre (overflow hidden/clip) : présent dans le DOM, invisible à l'écran.
  const decoupe = (e, r) => {
    for (let n = e.parentElement; n && n !== racine; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflowX !== 'hidden' && cs.overflowX !== 'clip') continue;
      const a = n.getBoundingClientRect();
      if (r.right > a.right + 0.5 || r.left < a.left - 0.5) return true;
    }
    return false;
  };

  /* --- critère 2 : éléments visibles hors du cadre horizontal --- */
  const dehors = [];
  for (const e of document.querySelectorAll('body *')) {
    if (e.tagName === 'SCRIPT' || e.tagName === 'STYLE' || e.tagName === 'DIALOG') continue;
    const r = e.getBoundingClientRect();
    if (!estVisible(e)) continue;
    if (estFixe(e)) continue;
    if (sousDefilementLateral(e)) continue;
    if (r.left >= -0.5 && r.right <= window.innerWidth + 0.5) continue;
    if (decoupe(e, r)) continue;
    dehors.push({
      nom: nomCourt(e),
      gauche: court1(r.left), droite: court1(r.right), largeur: court1(r.width),
      texte: texte(e, 32),
    });
  }

  /* --- critère 3 : débordement masqué --- */
  const debordMasques = [];
  const vus3 = new Set();
  for (const e of document.querySelectorAll('.card, .scroll-card, .lots, .home-grid > *')) {
    if (vus3.has(e)) continue;
    vus3.add(e);
    if (getComputedStyle(e).display === 'none') continue;
    const eco = e.scrollWidth - e.clientWidth;
    let exemption = null;
    if (e.classList.contains('tabs')) exemption = '.tabs';
    else if (opt.gabarit === 'É4' && (e.classList.contains('tbl-wrap') || e.classList.contains('grav-list'))) exemption = nomCourt(e) + ' (É4)';
    debordMasques.push({
      nom: nomCourt(e), eco, client: e.clientWidth, scroll: e.scrollWidth, exemption,
      texte: texte(e, 28),
    });
  }

  /* --- critères 4 et 5 : onglets de filtre, barre d'onglets basse --- */
  const tabs = (() => {
    const t = document.querySelector('.tabs');
    if (!t) return null;
    const rt = t.getBoundingClientRect();
    const carte = t.closest('.card');
    const rc = carte ? carte.getBoundingClientRect() : null;
    const btns = Array.from(t.querySelectorAll('button'));
    return {
      selecteur: nomCourt(t),
      eco: t.scrollWidth - t.clientWidth,
      overflowX: getComputedStyle(t).overflowX,
      ecartCarte: rc ? { gauche: court1(rt.left - rc.left), droite: court1(rc.right - rt.right) } : null,
      accent: couleur(getComputedStyle(racine).getPropertyValue('--accent')),
      boutons: btns.map(x => {
        const r = x.getBoundingClientRect(), cs = getComputedStyle(x);
        return {
          libelle: texte(x, 20),
          l: court1(r.width), h: court1(r.height),
          dedans: r.left >= rt.left - 0.5 && r.right <= rt.right + 0.5,
          actif: x.getAttribute('aria-selected') === 'true',
          souligne: cs.borderBottomColor, souligneLargeur: num(cs.borderBottomWidth),
        };
      }),
    };
  })();

  const barre = document.getElementById('tabbar');
  const onglets = (() => {
    if (!barre) return { presente: false };
    const cs = getComputedStyle(barre), r = barre.getBoundingClientRect();
    const liens = Array.from(barre.querySelectorAll('a'));
    const vus = liens.filter(a => a.getBoundingClientRect().height > 0 && a.getBoundingClientRect().width > 0);
    const actif = vus.find(a => a.getAttribute('aria-current') === 'page') || null;
    return {
      presente: true,
      affichage: cs.display,
      visible: cs.display !== 'none' && cs.visibility !== 'hidden' && r.height > 1 && r.width > 1,
      hauteur: court1(r.height),
      gauche: court1(r.left), largeur: court1(r.width), bas: court1(r.bottom),
      rubriques: liens.length,
      rubriquesVisibles: vus.length,
      libelles: vus.map(a => (a.textContent || '').trim()).join(', '),
      mini: vus.length ? Math.min(...vus.map(a => Math.min(a.getBoundingClientRect().width, a.getBoundingClientRect().height))) : 0,
      couleurActive: actif ? getComputedStyle(actif).color : null,
      accent: couleur(getComputedStyle(racine).getPropertyValue('--accent')),
    };
  })();

  /* --- critère 6 : colonne latérale --- */
  const laterale = (() => {
    const e = document.querySelector('.side');
    if (!e) return { presente: false };
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    return {
      presente: true, affichage: cs.display, largeur: court1(r.width),
      visible: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 1 && r.height > 1,
    };
  })();

  /* --- critère 7 : vue d'ensemble à une colonne --- */
  const grille = (() => {
    const t = Array.from(document.querySelectorAll('h1,h2,h3,h4'))
      .find(e => e.textContent.trim().replace(/\s+/g, ' ').startsWith('Lots en cours'));
    const carte = t ? (t.closest('.card') || t.parentElement) : null;
    if (!carte) return { trouvee: false, motif: 'carte « Lots en cours » introuvable (vue d’ensemble non affichée ?)' };
    let n = carte.parentElement;
    while (n && n !== racine && !((getComputedStyle(n).display).includes('grid') && n.children.length >= 2)) n = n.parentElement;
    if (!n || n === racine) return { trouvee: false, motif: 'aucune grille parente à la carte « Lots en cours »' };
    const cs = getComputedStyle(n);
    const pistes = cs.gridTemplateColumns.trim().split(/\s+(?![^(]*\))/).filter(Boolean);
    const enfants = Array.from(n.children).filter(c => c.getBoundingClientRect().width > 0);
    const a = enfants[0] ? enfants[0].getBoundingClientRect() : null;
    const c2 = enfants[1] ? enfants[1].getBoundingClientRect() : null;
    const interieur = n.clientWidth - num(cs.paddingLeft) - num(cs.paddingRight);
    const contenu = document.querySelector('.content');
    const interieurContenu = contenu ? contenu.clientWidth - num(getComputedStyle(contenu).paddingLeft) - num(getComputedStyle(contenu).paddingRight) : null;
    const lots = n.querySelector('.lots');
    const lotInter = lots ? lots.getBoundingClientRect().right - num(getComputedStyle(lots).paddingRight) - num(getComputedStyle(lots).borderRightWidth) : null;
    const lotsEl = Array.from(n.querySelectorAll('.lot')).map(l => l.getBoundingClientRect());
    const pile = document.querySelector('.side-stack');
    return {
      trouvee: true,
      selecteur: nomCourt(n),
      colonnes: pistes.length,
      pistes: cs.gridTemplateColumns,
      enfants: enfants.length,
      largeur1: a ? court1(a.width) : null,
      largeur2: c2 ? court1(c2.width) : null,
      memeLigne: (a && c2) ? Math.abs(a.top - c2.top) < 4 : null,
      sousLaPremiere: (a && c2) ? c2.top >= a.bottom - 1 : null,
      interieur: court1(interieur),
      interieurContenu: interieurContenu == null ? null : court1(interieurContenu),
      contenu: `${enfants[0] ? nomCourt(enfants[0]) : '?'} puis ${enfants[1] ? nomCourt(enfants[1]) : '?'}`,
      lotsDebordent: lotInter == null ? null : lotsEl.filter(r => r.right > lotInter + 0.5).length,
      lotsNombre: lotsEl.length,
      lotMinLargeur: lotsEl.length ? court1(Math.min(...lotsEl.map(r => r.width))) : null,
      pilePresente: !!pile,
      pileSousCarte: pile ? (pile.getBoundingClientRect().top + 0.1 >= carte.getBoundingClientRect().bottom - 1) : null,
    };
  })();

  /* --- critères 8 et 27 : interrupteurs, avec pastille et cible tactile --- */
  const interrupteurs = Array.from(document.querySelectorAll('.switch')).map(el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const av = getComputedStyle(el, '::before');
    const ap = getComputedStyle(el, '::after');
    const z = zoneTactile(el);
    const matrice = ap.transform;
    const tx = (() => {
      const m = /matrix\(([^)]+)\)/.exec(matrice || '');
      if (!m) return null;
      const parts = m[1].split(',').map(v => parseFloat(v.trim()));
      return parts.length >= 6 ? court1(parts[4]) : null;
    })();
    return {
      nom: el.getAttribute('aria-label') || el.dataset.id || 'interrupteur',
      visible: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0,
      largeur: court1(r.width), hauteur: court1(r.height),
      pseudoPosition: av.position, pseudoContenu: av.content,
      pseudoLargeur: num(av.width), pseudoHauteur: num(av.height),
      pastilleL: num(ap.width), pastilleH: num(ap.height),
      transform: matrice, translation: tx,
      coche: el.getAttribute('aria-checked') === 'true',
      cible: z,
    };
  });

  /* --- critère 9 : écart entre l'interrupteur et le bouton de suppression --- */
  const ecartsSuppression = [];
  for (const x of document.querySelectorAll('[data-action="rm-dev"]')) {
    const ligneDev = x.closest('tr') || x.parentElement;
    const sw = ligneDev ? ligneDev.querySelector('.switch') : null;
    if (!sw || !estVisible(x) || !estVisible(sw)) continue;
    const zs = zoneTactile(sw), zx = zoneTactile(x);
    ecartsSuppression.push({ ligne: nomCourt(ligneDev), ecart: court1(zx.g - zs.d) });
  }

  /* --- critère 10 : cibles tactiles --- */
  const cibles = { total: 0, tropPetites: [], exemptees: 0 };
  for (const e of document.querySelectorAll(opt.selCibles || 'a[href], button')) {
    if (e.closest('dialog:not([open])')) continue;      // dialogue fermée : hors périmètre
    if (e.matches('.kv dd a')) { cibles.exemptees++; continue; }   // lien « Recette », exempté
    if (!estVisible(e)) continue;
    const r = e.getBoundingClientRect();
    const z = zoneTactile(e);
    cibles.total++;
    const mini = e.tagName === 'TEXTAREA' ? z.h >= 44 : (z.l >= 44 && z.h >= 44);
    if (!mini) cibles.tropPetites.push({
      nom: nomCourt(e), l: z.l, h: z.h, texte: texte(e, 24),
      source: z.l > r.width + 0.5 || z.h > r.height + 0.5 ? '::before' : 'boîte',
    });
  }
  cibles.nombre = cibles.tropPetites.length;

  /* --- critère 11 : champs sans zoom --- */
  const champs = (() => {
    const racineChamps = opt.dansDialogue ? document.querySelector(opt.dansDialogue) : document;
    if (!racineChamps) return null;
    const liste = [];
    for (const e of racineChamps.querySelectorAll('input:not([type=radio]):not([type=hidden]), select, textarea')) {
      if (!estVisible(e)) continue;
      liste.push({ nom: nomCourt(e), taille: court1(num(getComputedStyle(e).fontSize)), texte: texte(e, 20) });
    }
    const conseil = racineChamps.querySelector('.stepper input');
    return {
      nb: liste.length,
      mini: liste.length ? Math.min(...liste.map(x => x.taille)) : null,
      tropPetits: liste.filter(x => x.taille < 16),   // 16 px : seuil du critère 11
      conseil: conseil ? court1(num(getComputedStyle(conseil).fontSize)) : null,
      liste,
    };
  })();

  /* --- critère 12 : journal du lot --- */
  const journal = (() => {
    const lis = Array.from(document.querySelectorAll('#journal-list li.jl'));
    if (!lis.length) return { nb: 0, lis: [] };
    const mesures = lis.map(li => {
      const jt = li.querySelector('.jt');
      if (!jt) return null;
      const cs = getComputedStyle(li), r = li.getBoundingClientRect();
      const interieur = r.right - num(cs.borderRightWidth) - num(cs.paddingRight);
      const rj = jt.getBoundingClientRect();
      return { largeur: court1(rj.width), ecartDroit: court1(rj.right - interieur), texte: texte(jt, 24) };
    }).filter(Boolean);
    return {
      nb: mesures.length,
      minLargeur: mesures.length ? Math.min(...mesures.map(x => x.largeur)) : null,
      maxEcartDroit: mesures.length ? Math.max(...mesures.map(x => Math.abs(x.ecartDroit))) : null,
      lis: mesures.slice(0, 3),
    };
  })();

  /* --- critères 13 et 20 : hauteurs indépendantes de la fenêtre --- */
  const dp = document.querySelector('.dp');
  const hauteurEl = sel => { const e = document.querySelector(sel); return e ? court1(e.getBoundingClientRect().height) : null; };
  const blocContenu = document.querySelector('.content') || racine;
  const hauteurs = {
    dp: dp ? court1(dp.getBoundingClientRect().height) : null,
    dpDisplay: dp ? getComputedStyle(dp).display : null,
    dpChart: hauteurEl('.dp-chart'),
    dpJournal: hauteurEl('.dp-journal'),
    arch2: hauteurEl('.arch-2'),
    contentPaddingHaut: court1(num(getComputedStyle(blocContenu).paddingTop)),
    contentPaddingBas: court1(num(getComputedStyle(blocContenu).paddingBottom)),
  };

  /* --- critères 14, 16, 21, 26 : classes, bouton de vue, cadre --- */
  const boutonVue = (() => {
    const e = document.getElementById('vueBtn');
    if (!e) return { present: false };
    const cs = getComputedStyle(e), r = e.getBoundingClientRect(), z = zoneTactile(e);
    return {
      present: true, affichage: cs.display, visible: estVisible(e),
      l: court1(r.width), h: court1(r.height),
      cible: z, ariaPressed: e.getAttribute('aria-pressed'),
      fond: cs.backgroundColor,
      fondAttendu: couleur(getComputedStyle(racine).getPropertyValue('--accent-soft')),
      gauche: court1(r.left), droite: court1(r.right),
    };
  })();

  const corps = document.body.getBoundingClientRect();
  const cadre = {
    body: { gauche: court1(corps.left), largeur: court1(corps.width) },
    innerH: window.innerHeight,
    topRight: (() => {
      const e = document.querySelector('.top-right');
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { gauche: court1(r.left), droite: court1(r.right), largeur: court1(r.width),
        haut: court1(r.top), bas: court1(r.bottom), hauteur: court1(r.height) };
    })(),
  };

  /* --- critère 15 : formulaire de recette --- */
  const rrows = Array.from(document.querySelectorAll('.rrow')).map(e => {
    const cs = getComputedStyle(e);
    const pistes = cs.gridTemplateColumns.trim().split(/\s+(?![^(]*\))/).filter(Boolean).map(v => court1(num(v)));
    const premier = e.children[0];
    const r = e.getBoundingClientRect();
    const debutContenu = r.left + num(cs.borderLeftWidth) + num(cs.paddingLeft);
    return {
      step: e.classList.contains('step'),
      pistes,
      brut: cs.gridTemplateColumns,
      premier: premier ? nomCourt(premier) : null,
      premierGauche: premier ? court1(premier.getBoundingClientRect().left - debutContenu) : null,
      premierLargeur: premier ? court1(premier.getBoundingClientRect().width) : null,
    };
  });

  /* --- critère 22 : graphiques redessinés --- */
  const graphiques = Array.from(document.querySelectorAll('[data-chart]')).map(el => {
    const cs = getComputedStyle(el);
    const interieur = el.clientWidth - num(cs.paddingLeft) - num(cs.paddingRight);
    const svg = el.querySelector('svg');
    return {
      nom: nomCourt(el),
      interieur: court1(interieur),
      svg: svg ? court1(svg.getBoundingClientRect().width) : null,
    };
  });

  /* --- critère 18 : équivalence F1 ⇄ É1 --- */
  const equivalence = opt.equivalence ? (() => {
    const sortie = {};
    const corpsGauche = document.body.getBoundingClientRect().left;
    for (const sel of opt.selecteurs) {
      sortie[sel] = Array.from(document.querySelectorAll(sel)).filter(estVisible).slice(0, 8).map(e => {
        const r = e.getBoundingClientRect();
        return { l: court1(r.width), h: court1(r.height), x: court1(r.left - corpsGauche), texte: texte(e, 18) };
      });
    }
    return sortie;
  })() : null;

  /* --- critère 29 : empreinte géométrique de tout le corps --- */
  const empreinte = opt.empreinte ? (() => {
    const liste = [];
    const signature = n => n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + '.'
      + ((n.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).join('.'));
    const parcours = (e, chemin, dansTopRight) => {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      liste.push({
        c: chemin,
        b: [arrondi(r.left), arrondi(r.top), arrondi(r.width), arrondi(r.height)],
        s: [cs.display, cs.position, cs.gridTemplateColumns, cs.height, cs.padding, cs.margin,
          cs.fontSize, cs.overflowX, cs.boxShadow],
        topRight: e.classList.contains('top-right'),
        dansTopRight,
        exclu: e.id === 'vueBtn' || e.classList.contains('vue-btn')
          || (e.getAttribute('data-action') || '').startsWith('vue'),
      });
      const compte = new Map();
      for (const n of e.children) {
        if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') continue;
        const s = signature(n), k = compte.get(s) || 0;
        compte.set(s, k + 1);
        parcours(n, chemin + '>' + s + '[' + k + ']', dansTopRight || e.classList.contains('top-right'));
      }
    };
    for (const n of document.body.children) {
      if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') continue;
      parcours(n, signature(n) + '[0]', false);
    }
    return liste;
  })() : null;

  return {
    route: location.hash || '#/',
    gabarit: opt.gabarit,
    viewport: window.innerWidth + '×' + window.innerHeight,
    classeHtml: racine.className || '(vide)',
    vueTel: racine.classList.contains('vue-tel'),
    tactile: racine.classList.contains('tactile'),
    debordHtml: racine.scrollWidth - racine.clientWidth,
    debordBody: document.body.scrollWidth - document.body.clientWidth,
    largeurUtile: racine.clientWidth,
    dehors, debordMasques, tabs, onglets, laterale, grille, interrupteurs,
    ecartsSuppression, cibles, champs, journal, hauteurs, boutonVue, cadre, rrows,
    graphiques, equivalence, empreinte,
  };
}, opt);

/* ---------- Navigation et attentes ---------- */
const charger = async (url, attente = 700) => {
  if (urlChargee === url) return;
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  urlChargee = url;
  await attendre(attente);
};
/* Clic « réel » (souris de bout en bout) seulement là où la spécification l'exige —
   le bouton de vue forcée. Ailleurs, un clic par script : c'est ce que fait un doigt au
   niveau de la page, et cela évite qu'un clic aux coordonnées tombe sur un autre élément
   (barre d'onglets fixe, conteneur qui défile). */
const cliquerSel = async (sel, reel = false) => {
  if (reel) {
    try {
      await p.click(sel);
      return true;
    } catch (e) { /* on retombe sur le clic par script juste après */ }
  }
  return await p.evaluate(s => {
    const el = document.querySelector(s);
    if (!el) return false;
    el.click();
    return true;
  }, sel);
};
const routeCourante = () => p.evaluate(() => location.hash || '#/');
const allerPage = async (page, attente = 360) => {
  await p.evaluate(h => {
    if ((location.hash || '#/') === h) window.dispatchEvent(new HashChangeEvent('hashchange'));
    else location.hash = h;
  }, page.hash);
  await attendre(attente);
  for (const sel of page.clics) { await cliquerSel(sel); await attendre(180); }
  /* La page redirige vers #/ toute route qu'elle ne reconnaît pas : si l'on mesure une
     autre page que celle demandée, il faut le dire plutôt que de comparer à côté. */
  let route = await routeCourante();
  if (route !== page.hash) {
    await p.evaluate(h => { location.hash = h; }, page.hash);
    await attendre(420);
    for (const sel of page.clics) { await cliquerSel(sel); await attendre(180); }
    route = await routeCourante();
  }
  return route;
};
/* Défilement complet de la page, pour que tout soit rendu avant de mesurer (critère 10). */
const defilerTout = async () => {
  await p.evaluate(async () => {
    const pas = Math.max(200, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += pas) {
      window.scrollTo(0, y);
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 30)));
    }
    window.scrollTo(0, 0);
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 40)));
  });
};

/* Les relevés sont conservés pour les comparaisons transverses (critères 13, 18, 20, 22). */
const mesures = new Map();
const cle = (g, pg) => `${g}|${pg}`;

/* ---------- Assertions réutilisables ---------- */
const verifieCommun = (cat, r) => {
  auPlus(cat, '1 · débordement horizontal (html)', 0, r.debordHtml);
  auPlus(cat, '1 · débordement horizontal (body)', 0, r.debordBody);
  auPlus(cat, '2 · éléments visibles hors du cadre', 0, r.dehors.length, 'élément(s)');
  if (r.dehors.length) {
    r.dehors.slice(0, 6).forEach(d => info(`  hors cadre : ${d.nom}`, `${d.gauche} → ${d.droite} px (largeur ${d.largeur}) « ${d.texte} »`));
    if (r.dehors.length > 6) info(`  … et ${r.dehors.length - 6} autre(s)`, 'non détaillé(s)');
  }
  const fautifs = r.debordMasques.filter(d => !d.exemption && d.eco > 1);
  auPlus(cat, `3 · débordements masqués (sur ${r.debordMasques.length} boîtes)`, 0, fautifs.length, 'boîte(s)');
  fautifs.slice(0, 6).forEach(d => info(`  masqué : ${d.nom}`, `scrollWidth ${d.scroll} − clientWidth ${d.client} = ${d.eco} px « ${d.texte} »`));
  const exempts = r.debordMasques.filter(d => d.exemption);
  if (exempts.length) info('  exceptions permises (critère 3)', exempts.map(d => `${d.nom} (${d.eco} px)`).join(', '));
};

const verifieOngletsBas = (cat, r) => {
  controle(cat, '5 · affichage calculé de #tabbar', 'flex', r.onglets.affichage ?? 'absente');
  controle(cat, '5 · libellés des rubriques', 'Accueil, Archive, Recettes, Appareils', r.onglets.libelles || '—');
  controle(cat, '5 · nombre de rubriques', 4, r.onglets.rubriquesVisibles ?? 0);
  egalA(cat, '5 · hauteur de la barre d’onglets', 64, r.onglets.hauteur ?? 0, 1);
  egalA(cat, '5 · bas de la barre = bas de la fenêtre', r.cadre.innerH, r.onglets.bas ?? 0, 0.5);
  auMoins(cat, '5 · plus petite cible d’onglet', 44, r.onglets.mini ?? 0);
  if (r.onglets.couleurActive) {
    controle(cat, '5 · couleur de la rubrique courante = --accent', r.onglets.accent, r.onglets.couleurActive);
  } else {
    controle(cat, '5 · rubrique courante marquée (aria-current)', 'marquée', 'aucune');
  }
  controle(cat, '6 · colonne latérale masquée (.side)', 'none', r.laterale.presente ? r.laterale.affichage : 'absente du DOM');
  if (r.laterale.presente) info('  colonne latérale', r.laterale.visible ? `VISIBLE (${r.laterale.largeur} px)` : `masquée (${r.laterale.affichage})`);
};

const verifieInterrupteurs = (cat, r, regime) => {
  const sw = r.interrupteurs.filter(x => x.visible);
  info('interrupteurs mesurés', `${sw.length} sur ${r.interrupteurs.length}`);
  if (!sw.length) {
    controle(cat, '8 · interrupteur des prises présent (.switch)', 'trouvé', 'aucun interrupteur visible');
    return;
  }
  const maxDe = k => Math.max(...sw.map(x => x[k]));
  const minCible = k => Math.min(...sw.map(x => x.cible[k]));
  if (regime === 'etroit' || regime === 'force') {
    egalA(cat, '8 · largeur de l’interrupteur', 56, maxDe('largeur'), 0.5);
    egalA(cat, '8 · hauteur de l’interrupteur', 32, maxDe('hauteur'), 0.5);
    const sansBefore = sw.filter(x => !(x.pseudoPosition === 'absolute' && x.pseudoLargeur > 0 && x.pseudoHauteur > 0));
    auPlus(cat, '8 · interrupteurs sans ::before en absolute', 0, sansBefore.length, 'interrupteur(s)');
    auPlus(cat, '8 · pastille ::after hors 28 × 28', 0,
      sw.filter(x => Math.abs(x.pastilleL - 28) > 0.5 || Math.abs(x.pastilleH - 28) > 0.5).length, 'interrupteur(s)');
    auPlus(cat, '8 · translation de ::after erronée (24 px si cochée, aucune sinon)', 0,
      sw.filter(x => x.coche ? !(x.translation !== null && Math.abs(x.translation - 24) <= 0.5)
        : !(x.transform === 'none' || x.translation === 0)).length, 'interrupteur(s)');
    const ex = sw[0];
    info('  exemple', `${ex.nom} — bouton ${ex.largeur}×${ex.hauteur}, cible ${ex.cible.l}×${ex.cible.h}, pastille ${ex.pastilleL}×${ex.pastilleH}, transform ${ex.transform}`);
    egalA(cat, '8 · largeur de la zone tactile', 56, minCible('l'), 0.5);
    egalA(cat, '8 · hauteur de la zone tactile', 44, minCible('h'), 0.5);
    const ecarts = r.ecartsSuppression.map(x => x.ecart);
    if (ecarts.length) {
      auMoins(cat, '9 · écart interrupteur → suppression', 8, Math.min(...ecarts), 'px');
      info('  écart mesuré (valeur attendue 11)', ecarts.map(e => nombre(e)).join(', '));
    } else {
      info('9 · écart interrupteur → suppression', 'non mesuré (aucune ligne de prise avec les deux)');
    }
  } else {
    // Critère 27 : au bureau, l'interrupteur garde sa taille de souris.
    egalA(cat, '27 · largeur de l’interrupteur de bureau', 36, maxDe('largeur'), 0.5);
    egalA(cat, '27 · hauteur de l’interrupteur de bureau', 20, maxDe('hauteur'), 0.5);
    auPlus(cat, '27 · pastille ::after de bureau hors 16 × 16', 0,
      sw.filter(x => Math.abs(x.pastilleL - 16) > 0.5 || Math.abs(x.pastilleH - 16) > 0.5).length, 'interrupteur(s)');
    controle(cat, '27 · contenu calculé du ::before (aucun)', 'none', sw[0].pseudoContenu);
  }
};

const verifieCibles = (cat, r, etiquette) => {
  auPlus(cat, `10 · cibles tactiles sous 44 × 44 (${etiquette})`, 0, r.cibles.nombre, 'élément(s)');
  info(`  relevé de contrôle (${etiquette})`, `${r.cibles.nombre} trop petite(s) sur ${r.cibles.total} visibles, ${r.cibles.exemptees} exemptée(s)`);
  r.cibles.tropPetites.slice(0, 8).forEach(x => info(`  trop petite : ${x.nom}`, `${x.l} × ${x.h} (${x.source}) « ${x.texte} »`));
  if (r.cibles.tropPetites.length > 8) info(`  … et ${r.cibles.tropPetites.length - 8} autre(s)`, 'non détaillée(s)');
};

const verifieChamps = (cat, r, etiquette) => {
  if (!r.champs || !r.champs.nb) { info(`11 · champs (${etiquette})`, 'aucun champ visible'); return; }
  auMoins(cat, `11 · plus petit champ ≥ 16 px (${etiquette})`, CHAMP_MINI_PX, r.champs.mini, 'px');
  auPlus(cat, `11 · champs sous 16 px (${etiquette})`, 0, r.champs.tropPetits.length, 'champ(s)');
  r.champs.tropPetits.slice(0, 6).forEach(x => info(`  champ trop petit : ${x.nom}`, `${x.taille} px « ${x.texte} »`));
  if (r.champs.conseil != null) egalA(cat, '11 · consigne (.stepper input)', CONSEIL_PX, r.champs.conseil, 0.5, 'px');
};

const verifieJournal = (cat, r, etiquette) => {
  if (!r.journal.nb) { info(`12 · journal du lot (${etiquette})`, 'aucune ligne .jl (page sans journal ?)'); return; }
  auMoins(cat, `12 · largeur de .jt ≥ 250 px (${etiquette})`, 250, r.journal.minLargeur, 'px');
  auPlus(cat, `12 · écart .jt ↔ intérieur du li (${etiquette})`, 1, r.journal.maxEcartDroit, 'px');
  r.journal.lis.forEach(x => info('  exemple .jt', `${x.largeur} px, écart droit ${x.ecartDroit} px « ${x.texte} »`));
};

/* ---------- Boucle principale ---------- */
const ordonnes = [...gabaritsRetenus].sort((a, c) => a.poids - c.poids || GABARITS.indexOf(a) - GABARITS.indexOf(c));

for (const G of ordonnes) {
  titre(`=== Gabarit ${G.code} — ${G.l} × ${G.h} (${G.regime}) — ${G.nom} ===`);
  await p.setViewport({ width: G.l, height: G.h, deviceScaleFactor: 1 });
  urlChargee = null;
  erreurs = [];

  for (const P of pagesRetenues) {
    await charger(cibleMesuree, G.regime === 'etroit' ? 750 : 900);
    if (G.regime === 'force') await p.evaluate(() => document.documentElement.classList.remove('vue-tel'));
    const route = await allerPage(P);
    if (route !== P.hash) ligne(false, 'navigation', `${P.code} · route effectivement atteinte (${G.code})`, route, P.hash);
    await defilerTout();

    /* Critère 22 : état de départ de l'aller-retour (F1 fait 1440 × 900, comme B2). */
    let avantClic = null;
    if (G.regime === 'force' && G.code === 'F1') avantClic = await releve({ gabarit: G.code, empreinte: true });

    const opt = { gabarit: G.code, selCibles: SEL_CIBLES,
      equivalence: G.regime !== 'bureau', selecteurs: SELECTEURS_18,
      empreinte: G.regime === 'bureau' };
    const r = await releve(opt);

    console.log(`  -- ${P.code} ${P.nom} (${r.route}) — cadre ${r.viewport}, largeur utile ${r.largeurUtile} px --`);

    if (G.regime === 'etroit') {
      verifieCommun('etroit ' + G.code, r);
      verifieOngletsBas('etroit ' + G.code, r);

      /* critère 7 : vue d'ensemble à une colonne (P1) */
      if (P.code === 'P1') {
        const attendus = { 'É1': 398, 'É3': 358, 'É4': 328, 'É5': 820 };
        if (!r.grille.trouvee) {
          controle('etroit 7', `7 · grille de la vue d’ensemble (${G.code})`, 'trouvée', r.grille.motif);
        } else {
          info('  grille mesurée', `${r.grille.selecteur} — pistes : ${r.grille.pistes}`);
          controle('etroit 7', `7 · grille à une seule colonne (${G.code})`, 1, r.grille.colonnes);
          if (r.grille.interieurContenu != null) {
            egalA('etroit 7', `7 · carte = largeur intérieure du contenu (${G.code})`, r.grille.interieurContenu, r.grille.largeur1, 1);
          }
          if (attendus[G.code]) info('  repère de la spécification', `${attendus[G.code]} px attendus pour ${G.code}, ${r.grille.largeur1} px mesurés`);
          controle('etroit 7', `7 · 2ᵉ colonne sous la 1ʳᵉ (${G.code})`, 'sous', r.grille.memeLigne === null ? 'non mesurable' : (r.grille.sousLaPremiere ? 'sous' : 'À CÔTÉ'));
          if (r.grille.lotsDebordent != null) auPlus('etroit 7', `7 · lots sortant de .lots (${G.code})`, 0, r.grille.lotsDebordent, 'lot(s)');
          if (G.code === 'É1' && r.grille.lotMinLargeur != null) {
            auMoins('etroit 7', '7 · largeur de chaque lot ≥ 370 px (É1)', 370, r.grille.lotMinLargeur);
          }
          if (r.grille.pilePresente) {
            controle('etroit 7', '7 · .side-stack sous la carte « Lots en cours »', 'sous', r.grille.pileSousCarte ? 'sous' : 'À CÔTÉ');
          }
        }
      }

      /* critère 4 : onglets de filtre (P2). Le seuil de 1 px de débordement et la présence
         des 4 onglets dans la boîte sont exigés À É1 ; à É3 et É4 la spécification autorise
         le défilement latéral de la barre, sous réserve qu'elle reste dans sa carte. */
      if (P.code === 'P2' && r.tabs) {
        info('  onglets', r.tabs.boutons.map(b => `${b.libelle} ${b.l}×${b.h}`).join(' · '));
        if (G.code === 'É1') {
          auPlus('etroit 4', '4 · débordement des onglets de filtre (É1)', 1, r.tabs.eco);
          const dehorsTabs = r.tabs.boutons.filter(b => !b.dedans);
          auPlus('etroit 4', '4 · onglets sortant de .tabs (É1)', 0, dehorsTabs.length, 'onglet(s)');
          auMoins('etroit 4', '4 · hauteur de chaque onglet ≥ 44 px (É1)', 44, Math.min(...r.tabs.boutons.map(b => b.h)));
        } else {
          info(`4 · onglets de filtre (${G.code})`, `${r.tabs.eco} px de défilement propre, overflow-x calculé ${r.tabs.overflowX}`);
        }
        if (G.code === 'É3' || G.code === 'É4') {
          if (r.tabs.ecartCarte) {
            ligne(r.tabs.ecartCarte.gauche >= -1 && r.tabs.ecartCarte.droite >= -1, 'etroit 4',
              `4 · .tabs reste dans sa carte (${G.code})`,
              `jeu ${nombre(r.tabs.ecartCarte.gauche)} / ${nombre(r.tabs.ecartCarte.droite)} px`, 'au moins −1 px des deux côtés');
          }
          controle('etroit 4', `4 · overflow-x calculé de .tabs (${G.code})`, 'auto', r.tabs.overflowX);
          const actif = r.tabs.boutons.find(b => b.actif);
          if (actif) controle('etroit 4', `4 · souligné de l’onglet actif = --accent (${G.code})`, r.tabs.accent, actif.souligne);
          else controle('etroit 4', `4 · onglet actif marqué (${G.code})`, 'marqué', 'aucun');
        }
      }

      /* critères 8 et 9 : interrupteur (P2) */
      if (P.code === 'P2') verifieInterrupteurs('etroit 8', r, 'etroit');

      /* critère 10 : cibles tactiles, sur toutes les pages */
      verifieCibles('tactile', r, `${P.code} à ${G.code}`);

      /* critère 11 : champs sans zoom (P2, P3, P4, P7) */
      if (P.code === 'P2' || P.code === 'P3' || P.code === 'P4' || P.code === 'P7') {
        verifieChamps('tactile', r, `${P.code} à ${G.code}`);
      }
      /* critère 11 (suite) : boîte « Ajouter un appareil » (P2) */
      if (P.code === 'P2') {
        await cliquerSel('[data-action="add-dev"]');
        await attendre(320);
        const rd = await releve({ gabarit: G.code, dansDialogue: '#dlg', selCibles: SEL_CIBLES });
        verifieChamps('tactile', rd, `boîte « Ajouter un appareil » à ${G.code}`);
        verifieCibles('tactile', rd, `${P.code} à ${G.code}, boîte « Ajouter un appareil » ouverte`);
        await p.evaluate(() => { const d = document.getElementById('dlg'); if (d && d.open) d.close(); });
        await attendre(200);
      }

      /* critère 12 : journal du lot (P4). La spécification fixe le seuil « à É1 » ; aux
         autres gabarits étroits le relevé est imprimé sans être exigé. */
      if (P.code === 'P4') {
        if (G.code === 'É1') verifieJournal('tactile', r, `${P.code} à ${G.code}`);
        else if (r.journal.nb) info(`12 · journal du lot (${P.code} à ${G.code})`, `non exigé hors É1 — ${r.journal.minLargeur} px au plus étroit`);
      }

      /* critère 14 : classes et bouton masqué */
      controle('etroit 14', `14 · classe tactile sur <html> (${G.code})`, 'posée', r.tactile ? 'posée' : `absente (${r.classeHtml})`);
      controle('etroit 14', `14 · classe vue-tel absente (${G.code})`, 'absente', r.vueTel ? 'PRÉSENTE' : 'absente');
      controle('etroit 14', `14 · #vueBtn masqué (${G.code})`, 'none', r.boutonVue.present ? r.boutonVue.affichage : 'bouton absent du DOM');

      /* critère 15 : formulaire de recette intact (P7 à É1) */
      if (P.code === 'P7' && G.code === 'É1') {
        if (!r.rrows.length) controle('etroit 15', '15 · lignes .rrow trouvées (P7)', 'trouvées', 'aucune');
        const etapes = r.rrows.filter(x => x.step), ingredients = r.rrows.filter(x => !x.step);
        if (etapes.length) {
          const p = etapes[0].pistes;
          ligne(p.length === 3 && Math.abs(p[0] - 24) <= 0.5 && Math.abs(p[2] - 34) <= 0.5 && p[1] > 24,
            'etroit 15', '15 · pistes .rrow.step (24 px, quantité, 34 px)', `[${p.map(nombre).join(', ')}]`, '24, <x>, 34');
          const ix = etapes.find(x => x.premierGauche != null);
          if (ix) auPlus('etroit 15', '15 · numéro d’étape aligné sur la colonne de 24 px', 1, Math.abs(ix.premierGauche), 'px');
        } else info('15 · pistes .rrow.step', 'aucune ligne .rrow.step visible');
        if (ingredients.length) {
          const p = ingredients[0].pistes;
          ligne(p.length === 3 && Math.abs(p[1] - 96) <= 0.5 && Math.abs(p[2] - 34) <= 0.5,
            'etroit 15', '15 · pistes .rrow d’ingrédient (<x> px, 96 px, 34 px)', `[${p.map(nombre).join(', ')}]`, '<x>, 96, 34');
        } else info('15 · pistes .rrow d’ingrédient', 'aucune ligne visible');
      }
    }

    if (G.regime === 'bureau') {
      verifieCommun('bureau ' + G.code, r);
      controle('bureau 6', `6 · colonne latérale visible (${G.code})`, 'visible', r.laterale.visible ? 'visible' : `masquée (${r.laterale.affichage ?? 'absente'})`);
      controle('bureau 5', `5 · barre d’onglets masquée (${G.code})`, 'masquée', r.onglets.visible ? 'VISIBLE' : 'masquée');
      controle('bureau 26', `26 · aucune classe sur <html> (${G.code})`, '(vide)', r.classeHtml);
      /* Décision de l'utilisateur : le bureau large reste identique au pixel. Le bouton de
         vue est donc masqué au-dessus de 1100 px (hors vue forcée) — présent dans le DOM,
         invisible, sans effet sur la zone de droite. Il reste atteignable jusqu'à 1100 px
         (téléphone en paysage, tablette) et dans la vue forcée, pour pouvoir en sortir. */
      if (!r.boutonVue.present) {
        controle('bureau 26', '26 · bouton de vue présent dans le DOM (#vueBtn)', 'présent', 'absent du DOM');
      } else {
        controle('bureau 26', `26 · bouton de vue masqué au-dessus de 1100 px (${G.code})`, 'masqué (none)', r.boutonVue.visible ? 'visible' : `masqué (${r.boutonVue.affichage})`);
      }
      if (P.code === 'P2') verifieInterrupteurs('bureau 27', r, 'bureau');

      /* critère 28 : champs, boutons et grille de bureau (la spécification vise P2 et P7) ;
         les selects de prise, eux, ne vivent que sur la page Prises (P3). */
      if (P.code === 'P2' || P.code === 'P7') {
        if (r.champs && r.champs.nb) {
          const tailles = [...new Set(r.champs.liste.map(x => x.taille))];
          info(`  tailles de champs au bureau (${P.code})`, tailles.map(nombre).join(', ') + ' px');
          auPlus('bureau 28', `28 · champ au bureau hors 14 ou 13 px (${P.code})`, 0,
            r.champs.liste.filter(x => x.taille !== 14 && x.taille !== 13).length, 'champ(s)');
        }
        const btns = await p.evaluate(() => {
          const hs = s => Array.from(document.querySelectorAll(s)).map(e => Math.round(parseFloat(getComputedStyle(e).height) * 10) / 10);
          const fs = s => Array.from(document.querySelectorAll(s)).map(e => Math.round(parseFloat(getComputedStyle(e).fontSize) * 10) / 10);
          return {
            btn: [...new Set(hs('.btn:not(.sm)'))], btnSm: [...new Set(hs('.btn.sm'))],
            seg: [...new Set(hs('.seg button'))], selectTable: [...new Set(fs('table.data select'))],
          };
        });
        const uniques = (liste, attendu, nom) => {
          if (!liste.length) { info(`28 · ${nom} (${P.code})`, 'aucun élément'); return; }
          liste.forEach(v => egalA('bureau 28', `28 · ${nom} (${P.code})`, attendu, v, 0.5));
        };
        uniques(btns.btn, 36, 'hauteur de .btn');
        uniques(btns.btnSm, 30, 'hauteur de .btn.sm');
        uniques(btns.seg, 30, 'hauteur de .seg button');
        uniques(btns.selectTable, 13, 'font-size de table.data select');
      }
      if (P.code === 'P3') {
        const of = await p.evaluate(() => [...new Set(Array.from(document.querySelectorAll('.o-f select'))
          .map(e => Math.round(parseFloat(getComputedStyle(e).fontSize) * 10) / 10))]);
        if (!of.length) info('28 · font-size de .o-f select (P3)', 'aucun élément');
        else of.forEach(v => egalA('bureau 28', '28 · font-size de .o-f select (P3)', 13, v, 0.5));
      }
      if (P.code === 'P1' && r.grille.trouvee) {
        const attendu = G.code === 'B1' ? 300 : 340;
        const pistes = r.grille.pistes.trim().split(/\s+(?![^(]*\))/).filter(Boolean);
        if (pistes.length >= 2) egalA('bureau 28', `28 · dernière piste de .home-grid (${G.code})`, attendu, parseFloat(pistes[pistes.length - 1]), 0.5);
        else controle('bureau 28', `28 · pistes de .home-grid (${G.code})`, '2 pistes', pistes.join(' '));
      }
      if (r.empreinte) info(`  empreinte géométrique (${G.code}/${P.code})`, `${r.empreinte.length} éléments`);
    }

    if (G.regime === 'force' && G.code === 'F1') {
      /* --- critère 16 : vue forcée par le chemin réel (clic sur #vueBtn) --- */
      const clique = await cliquerSel('#vueBtn', true);
      await attendre(480);
      const rf = await releve(opt);
      if (!r.boutonVue.present) controle('force 16', '16 · clic sur #vueBtn (chemin réel)', 'bouton présent', 'absent du DOM');
      else if (!clique) controle('force 16', '16 · clic sur #vueBtn (chemin réel)', 'clic effectué', 'clic impossible');

      controle('force 16', `16 · classes après le clic (${P.code})`, 'vue-tel tactile',
        `${rf.vueTel ? 'vue-tel' : '—'} ${rf.tactile ? 'tactile' : '—'}`);
      controle('force 16', `16 · aria-pressed après le clic (${P.code})`, 'true', rf.boutonVue.ariaPressed ?? 'absent');

      /* --- critère 17 : cadre de 430 px --- */
      egalA('force 17', `17 · largeur de body = 430 px (${P.code})`, 430, rf.cadre.body.largeur, 0.5);
      egalA('force 17', `17 · bord gauche de body (${P.code})`, 505, rf.cadre.body.gauche, 1);
      if (rf.onglets.presente) {
        egalA('force 17', `17 · bord gauche de #tabbar (${P.code})`, 505, rf.onglets.gauche, 1);
        egalA('force 17', `17 · largeur de #tabbar (${P.code})`, 430, rf.onglets.largeur, 0.5);
        egalA('force 17', `17 · bas de #tabbar (${P.code})`, rf.cadre.innerH, rf.onglets.bas ?? 0, 0.5);
      } else controle('force 17', `17 · #tabbar présente (${P.code})`, 'présente', 'absente');

      /* --- critère 19 : les invariants mobiles tiennent en vue forcée --- */
      verifieCommun('force 19', rf);
      verifieOngletsBas('force 19', rf);
      if (P.code === 'P1' && rf.grille.trouvee) {
        controle('force 19', `19 · grille à une seule colonne (${P.code})`, 1, rf.grille.colonnes);
        if (rf.grille.interieurContenu != null) egalA('force 19', `19 · colonne de 398 px (${P.code})`, 398, rf.grille.largeur1, 1);
      }
      if (P.code === 'P2') verifieInterrupteurs('force 19', rf, 'force');
      verifieCibles('tactile', rf, `${P.code} en vue forcée (F1)`);
      if (P.code === 'P2' || P.code === 'P3' || P.code === 'P4' || P.code === 'P7') verifieChamps('tactile', rf, `${P.code} en vue forcée (F1)`);
      if (P.code === 'P4') verifieJournal('tactile', rf, `${P.code} en vue forcée (F1)`);

      /* --- critère 20 (première moitié) : le verrou de hauteur est déjà neutralisé en F1 --- */
      ligne(String(rf.hauteurs.dpDisplay ?? 'sans .dp') !== 'flex', 'force 20',
        `20 · display calculé de .dp ≠ flex (${P.code}, F1)`, rf.hauteurs.dpDisplay ?? 'sans .dp', 'différent de flex');

      /* --- critère 21 : bouton enfoncé --- */
      if (rf.boutonVue.present && rf.boutonVue.visible) {
        egalA('force 21', '21 · taille visible du bouton enfoncé', 34, Math.max(rf.boutonVue.l, rf.boutonVue.h), 0.5);
        auMoins('force 21', '21 · zone tactile du bouton enfoncé', 44, Math.min(rf.boutonVue.cible.l, rf.boutonVue.cible.h));
        controle('force 21', '21 · fond du bouton = --accent-soft', rf.boutonVue.fondAttendu, rf.boutonVue.fond);
      } else {
        controle('force 21', '21 · bouton enfoncé visible en vue forcée', 'visible', rf.boutonVue.present ? `masqué (${rf.boutonVue.affichage})` : 'absent du DOM');
      }

      /* --- critère 18 : équivalence avec É1 --- */
      const ref1 = mesures.get(cle('É1', P.code));
      if (!ref1 || !ref1.equivalence) info(`18 · équivalence (${P.code})`, 'référence É1 non mesurée (--gabarits ?)');
      else {
        for (const sel of SELECTEURS_18) {
          const a = ref1.equivalence[sel] || [], c = (rf.equivalence || {})[sel] || [];
          if (!a.length && !c.length) continue;
          if (a.length !== c.length) {
            ligne(false, 'force 18', `18 · ${sel} — nombre d’éléments (${P.code})`, String(c.length), `${a.length} (É1)`);
            continue;
          }
          a.forEach((x, i) => {
            const y = c[i];
            ligne(Math.abs(x.l - y.l) <= 1 && Math.abs(x.h - y.h) <= 1 && Math.abs(x.x - y.x) <= 1,
              'force 18', `18 · ${sel}[${i}] (${P.code})`,
              `${y.l}×${y.h} à x ${y.x}`, `${x.l}×${x.h} à x ${x.x} (É1, ±1)`);
          });
        }
      }

      /* --- critère 22 : graphiques redessinés et retour sans résidu --- */
      const nonRedessines = rf.graphiques.filter(g => g.svg == null || Math.abs(g.svg - g.interieur) > 1);
      auPlus('force 22', `22 · graphiques non redessinés après la bascule (${P.code})`, 0, nonRedessines.length, 'graphique(s)');
      nonRedessines.slice(0, 4).forEach(g => info(`  graphique : ${g.nom}`, `svg ${g.svg ?? 'absent'} px pour ${g.interieur} px de conteneur`));

      await cliquerSel('#vueBtn', true);
      await attendre(480);
      const retour = await releve({ gabarit: G.code, empreinte: true });
      controle('force 22', `22 · classes revenues à l’état de bureau (${P.code})`, '(vide)', retour.classeHtml || '(vide)');
      comparerEmpreintes('force 22', `22 · aller-retour du bouton (${P.code})`, avantClic.empreinte, retour.empreinte, false);
    }

    if (G.regime === 'force' && G.code === 'F2') {
      /* --- critère 20 : verrou de hauteur neutralisé, F1 ⇄ F2 --- */
      const clique = await cliquerSel('#vueBtn', true);
      await attendre(480);
      const rf = await releve(opt);
      ligne(String(rf.hauteurs.dpDisplay ?? 'sans .dp') !== 'flex', 'force 20', `20 · display calculé de .dp ≠ flex (${P.code})`, rf.hauteurs.dpDisplay ?? 'sans .dp', 'différent de flex');
      if (P.code === 'P4' || P.code === 'P9') {
        if (rf.hauteurs.dp == null) {
          controle('force 20', `20 · .dp présente (${P.code})`, 'présente', 'absente du DOM');
        } else {
          const ref1 = mesures.get(cle('F1', P.code));
          const hF1 = ref1 ? ref1.hauteurs.dp : null;
          if (hF1 != null) egalA('force 20', `20 · hauteur de .dp identique F1 ⇄ F2 (${P.code})`, hF1, rf.hauteurs.dp, 1);
        }
        egalA('force 20', `20 · padding-top de .content (${P.code})`, 20, rf.hauteurs.contentPaddingHaut, 0.5);
        egalA('force 20', `20 · padding-bottom de .content (${P.code})`, 84, rf.hauteurs.contentPaddingBas, 0.5);
      } else if (rf.hauteurs.dp != null) {
        const ref1 = mesures.get(cle('F1', P.code));
        const hF1 = ref1 ? ref1.hauteurs.dp : null;
        if (hF1 != null) egalA('force 20', `20 · hauteur de .dp identique F1 ⇄ F2 (${P.code})`, hF1, rf.hauteurs.dp, 1);
      }
      if (clique) await cliquerSel('#vueBtn');
      await attendre(200);
    }

    /* Conserver le relevé pour les comparaisons transverses. */
    mesures.set(cle(G.code, P.code), r);

    /* --- critère 25 : console --- */
    controle('console', `25 · erreurs console ou exceptions (${G.code}/${P.code})`, 0, erreurs.length);
    if (erreurs.length) erreurs.slice(0, 4).forEach(e => info('  erreur :', e));
    erreurs = [];
  }
}

/* ---------- Critère 13 : indépendance de la hauteur (É1 ⇄ É2) ---------- */
titre('=== Critère 13 — indépendance de la hauteur : É1 (430 × 932) contre É2 (430 × 600) ===');
for (const codePage of ['P1', 'P4', 'P9']) {
  if (!pagesRetenues.some(x => x.code === codePage)) continue;
  const a = mesures.get(cle('É1', codePage)), c = mesures.get(cle('É2', codePage));
  if (!a || !c) { info(`13 · comparaison ${codePage}`, 'une des deux hauteurs n’a pas été mesurée (--gabarits ?)'); continue; }
  console.log(`  -- ${codePage} --`);
  if (a.hauteurs.dp == null) {
    info(`13 · .dp (${codePage})`, 'absente du DOM');
  } else {
    egalA('etroit 13', `13 · hauteur de .dp identique É1 ⇄ É2 (${codePage})`, a.hauteurs.dp, c.hauteurs.dp, 1);
    ligne(String(a.hauteurs.dpDisplay) !== 'flex', 'etroit 13',
      `13 · display calculé de .dp ≠ flex (${codePage})`, a.hauteurs.dpDisplay ?? '—', 'différent de flex');
  }
  for (const [k, attendu, nomSel] of [['dpChart', 380, '.dp-chart'], ['dpJournal', 420, '.dp-journal']]) {
    if (a.hauteurs[k] == null) { info(`13 · ${nomSel} (${codePage})`, 'absent du DOM'); continue; }
    /* Sur P9, le journal du lot EST la carte .arch-2 : la spécification lui fixe 320 px. */
    const estArch = k === 'dpJournal' && a.hauteurs.arch2 != null;
    const attenduReel = estArch ? 320 : attendu;
    egalA('etroit 13', `13 · hauteur de ${estArch ? '.dp-journal.arch-2' : nomSel} (${codePage} à É1)`, attenduReel, a.hauteurs[k], 0.5);
    if (c.hauteurs[k] != null) egalA('etroit 13', `13 · ${nomSel} stable à É2 (${codePage})`, a.hauteurs[k], c.hauteurs[k], 1);
  }
  if (a.hauteurs.arch2 != null) {
    egalA('etroit 13', `13 · hauteur de .arch-2 = 320 px (${codePage} à É1)`, 320, a.hauteurs.arch2, 0.5);
    if (c.hauteurs.arch2 != null) egalA('etroit 13', `13 · .arch-2 stable à É2 (${codePage})`, a.hauteurs.arch2, c.hauteurs.arch2, 1);
  } else info(`13 · .arch-2 (${codePage})`, 'absent du DOM');
}

/* ---------- Vue forcée posée par script, critères 23 et 24 ---------- */
const gabaritF1 = GABARITS.find(g => g.code === 'F1');
if (gabaritF1 && gabaritsRetenus.some(g => g.code === 'F1')) {
  titre('=== Vue forcée posée par script (chemin du banc d’origine) — critères 17, 18, 19 ===');
  await p.setViewport({ width: gabaritF1.l, height: gabaritF1.h, deviceScaleFactor: 1 });
  urlChargee = null;
  erreurs = [];
  for (const P of pagesRetenues) {
    await charger(cibleMesuree, 900);
    const routeScript = await allerPage(P);
    if (routeScript !== P.hash) ligne(false, 'navigation', `${P.code} · route effectivement atteinte (F1 par script)`, routeScript, P.hash);
    await defilerTout();
    await p.evaluate(() => document.documentElement.classList.add('vue-tel'));
    await attendre(420);
    const r = await releve({ gabarit: 'F1', selCibles: SEL_CIBLES, equivalence: true, selecteurs: SELECTEURS_18 });
    console.log(`  -- ${P.code} ${P.nom} par script (${r.route}) — classe « ${r.classeHtml} » --`);
    egalA('force 17', `17 · largeur de body = 430 px (${P.code}, script)`, 430, r.cadre.body.largeur, 0.5);
    egalA('force 17', `17 · bord gauche de body (${P.code}, script)`, 505, r.cadre.body.gauche, 1);
    verifieCommun('force 19', r);
    verifieOngletsBas('force 19', r);
    verifieCibles('tactile', r, `${P.code} en vue forcée par script`);
    const ref1 = mesures.get(cle('É1', P.code));
    if (!ref1 || !ref1.equivalence) info(`18 · équivalence par script (${P.code})`, 'référence É1 non mesurée');
    else {
      const ecarts = [];
      for (const sel of SELECTEURS_18) {
        const a = ref1.equivalence[sel] || [], c = r.equivalence[sel] || [];
        if (a.length !== c.length) { ecarts.push(`${sel} : ${c.length} contre ${a.length} éléments`); continue; }
        a.forEach((x, i) => {
          const y = c[i];
          if (Math.abs(x.l - y.l) > 1 || Math.abs(x.h - y.h) > 1 || Math.abs(x.x - y.x) > 1) {
            ecarts.push(`${sel}[${i}] : ${y.l}×${y.h} à x ${y.x} contre ${x.l}×${x.h} à x ${x.x}`);
          }
        });
      }
      auPlus('force 18', `18 · sélecteurs non équivalents à É1 (${P.code}, script)`, 0, ecarts.length, 'sélecteur(s)');
      ecarts.slice(0, 6).forEach(e => info('  écart avec É1 :', e));
    }
    await p.evaluate(() => document.documentElement.classList.remove('vue-tel'));
    await attendre(220);
    controle('console', `25 · erreurs console (vue forcée par script, ${P.code})`, 0, erreurs.length);
    erreurs = [];
  }

  /* ---------- Critère 23 : persistance et première image ---------- */
  titre('=== Critère 23 — persistance de la vue forcée et première image ===');
  await p.evaluateOnNewDocument(() => { try { localStorage.setItem('hakko-vue', 'tel'); } catch (e) {} });
  urlChargee = null;
  await charger(cibleMesuree, 900);
  const premiere = await p.evaluate(() => ({
    classePremiereImage: window.__premiereImage,
    classeApres: document.documentElement.className,
    cle: localStorage.getItem('hakko-vue'),
  }));
  info('  classe vue au premier rAF', premiere.classePremiereImage == null ? '(non relevée)' : premiere.classePremiereImage);
  controle('force 23', '23 · vue-tel présente dès le premier rAF', 'présente',
    (premiere.classePremiereImage || '').includes('vue-tel') ? 'présente' : `absente (${premiere.classePremiereImage})`);
  controle('force 23', '23 · classe vue-tel sur <html> après chargement', 'présente',
    (premiere.classeApres || '').includes('vue-tel') ? 'présente' : `absente (${premiere.classeApres})`);
  await cliquerSel('#vueBtn');
  await attendre(520);
  const apresSortie = await p.evaluate(() => ({ cle: localStorage.getItem('hakko-vue'), classe: document.documentElement.className }));
  controle('force 23', '23 · clé hakko-vue retirée à la sortie de la vue forcée', 'absente',
    apresSortie.cle === null ? 'absente' : `PRÉSENTE (${apresSortie.cle})`);
  info('  classe après sortie', apresSortie.classe || '(vide)');

  /* ---------- Critère 24 : logique des prises unique ---------- */
  titre('=== Critère 24 — dix bascules de la vue, même instance, même régulateur ===');
  urlChargee = null;
  await charger(cibleMesuree, 900);
  const lireRegul = () => p.evaluate(() => {
    let regul = null;
    try { regul = (typeof regulId !== 'undefined') ? String(regulId) : null; } catch (e) {}
    if (regul == null) { try { const v = JSON.parse(localStorage.getItem('hakko-regul') || 'null'); regul = v && v.id; } catch (e) {} }
    return { regul, navigations: performance.getEntriesByType('navigation').length, temoin: window.__chargements };
  });
  const avant24 = await lireRegul();
  info('  regulId avant les bascules', avant24.regul ?? 'non exposé par la page');
  requetesPrise = 0;
  let clicsFaits = 0;
  for (let i = 0; i < 10; i++) {
    if (await cliquerSel('#vueBtn')) clicsFaits++;
    await attendre(180);
  }
  await attendre(320);
  const apres24 = await lireRegul();
  controle('force 24', '24 · bascules effectuées', 10, clicsFaits);
  auPlus('force 24', '24 · requêtes vers api/prise pendant les bascules', 0, requetesPrise, 'requête(s)');
  controle('force 24', '24 · entrées de navigation (performance)', 1, apres24.navigations);
  controle('force 24', '24 · instance de page conservée (témoin)', avant24.temoin, apres24.temoin);
  if (avant24.regul == null && apres24.regul == null) {
    info('24 · regulId', 'non exposé par la page (ni variable globale, ni clé hakko-regul) : non mesurable');
  } else {
    controle('force 24', '24 · regulId identique avant et après', avant24.regul, apres24.regul);
  }
  await p.evaluate(() => { document.documentElement.classList.remove('vue-tel'); try { localStorage.clear(); } catch (e) {} });
}

/* ---------- Critères 29 et 30 : invariance du bureau, page contre référence ---------- */
const gabaritsBureau = ordonnes.filter(g => g.regime === 'bureau');
if (urlReference && gabaritsBureau.length) {
  titre('=== Critères 29 et 30 — invariance du bureau : page mesurée contre la référence ===');
  info('référence mesurée', urlReference);
  for (const G of gabaritsBureau) {
    await p.setViewport({ width: G.l, height: G.h, deviceScaleFactor: 1 });
    urlChargee = null;
    for (const P of pagesRetenues) {
      await charger(urlReference, 900);
      const routeRef = await allerPage(P);
      if (routeRef !== P.hash) ligne(false, 'navigation', `${P.code} · route effectivement atteinte (référence, ${G.code})`, routeRef, P.hash);
      await defilerTout();
      mesures.set(`REF|${G.code}|${P.code}`, await releve({ gabarit: G.code, empreinte: true }));
    }
  }
  for (const G of gabaritsBureau) {
    for (const P of pagesRetenues) {
      const a = mesures.get(`REF|${G.code}|${P.code}`), c = mesures.get(cle(G.code, P.code));
      if (!a || !c) continue;
      console.log(`  -- ${G.code} / ${P.code} --`);
      comparerEmpreintes('bureau 29', `29 · ${G.code}/${P.code}`, a.empreinte, c.empreinte, true);
      if (!options.sansPixels) {
        const masque = unionMasque(a.cadre.topRight, c.cadre.topRight);
        const pixels = await comparerPixels(G, P, masque);
        if (pixels == null) info(`30 · pixels (${G.code}/${P.code})`, 'comparaison impossible (capture indisponible)');
        else {
          if (pixels.differents < 0) ligne(false, 'bureau 30', `30 · tailles d’image différentes (${G.code}/${P.code})`, 'différentes', 'identiques');
          else auPlus('bureau 30', `30 · pixels différents (${G.code}/${P.code})`, 0, pixels.differents, 'pixel(s)');
          info('  image comparée', `${pixels.largeur} × ${pixels.hauteur}, rectangle masqué ${masque ? `${nombre(masque.largeur)}×${nombre(masque.hauteur)} à x ${nombre(masque.gauche)}` : 'aucun'}`);
          if (pixels.boite) info('  zone des différences', `x ${pixels.boite.x0} → ${pixels.boite.x1}, y ${pixels.boite.y0} → ${pixels.boite.y1}`);
        }
      }
    }
  }
  if (!options.sansPixels) fs.rmSync(dossierPixels, { recursive: true, force: true });
} else if (!urlReference && gabaritsBureau.length) {
  titre('=== Critères 29 et 30 — invariance du bureau ===');
  info('état', 'aucune référence fournie : passer --reference <fichier.html> pour comparer');
  info('rappel', `node ${path.basename(fileURLToPath(import.meta.url))} --reference "chemin/vers/page-avant-correctif.html"`);
}

/* ---------- Verdict ---------- */
titre('=== Verdict ===');
console.log(`  ${ok} assertion(s) OK, ${ko} KO`);
if (koParCategorie.size) {
  console.log('  assertions en échec :');
  [...koParCategorie.entries()].forEach(([cat, n]) => info('  ' + cat, `${n} échec(s)`));
}

let code = ko ? 1 : 0;

if (sabotage) {
  titre('=== Contrôle négatif (--sabotage) ===');
  info('copie temporaire', negatif.fichier);
  info('règle retirée', `ligne ${negatif.ligne} — ${negatif.texte}`);
  const visees = ['etroit É1', 'etroit É2', 'etroit É3', 'etroit É4', 'etroit É5', 'bureau B1', 'bureau B2', 'bureau B3'];
  const echecsVises = visees.reduce((n, k) => n + (koParCategorie.get(k) || 0), 0);
  info('assertions visées', `colonne latérale masquée (.side) — ${echecsVises} échec(s)`);
  if (ko > 0 && echecsVises > 0) {
    console.log(`  => CONTRÔLE NÉGATIF VALIDÉ : la régression introduite est bien détectée (code de sortie ${code}).`);
  } else {
    console.log('  => CONTRÔLE NÉGATIF NON VALIDÉ : la suite passe malgré la règle retirée.');
    console.log('     Le banc d’essai ne détecte pas cette régression : à corriger avant de s’y fier.');
    code = 2;
  }
}

await b.close();
console.log(`\ncode de sortie : ${code}`);
process.exit(code);

/* ---------- Comparaisons ---------- */
/* Critère 29 : boîtes (arrondies au ½ px) et propriétés calculées, élément par élément.
   Sont exclus #vueBtn et .top-right ; pour .top-right, seuls le bord droit (±0,5) et un
   élargissement de 48 px (±0,5) sont admis, et #themeBtn doit garder exactement sa boîte. */
function comparerEmpreintes(cat, etiquette, avant, apres, avecTopRight) {
  if (!avant || !apres) { info(`${etiquette} · empreinte`, 'indisponible'); return; }
  const carteB = new Map(apres.map(e => [e.c, e]));
  const carteA = new Map(avant.map(e => [e.c, e]));
  let ecartsBoite = 0, ecartsStyle = 0, uniques = 0, compares = 0;

  /* Une seule exclusion, et elle est voulue : #vueBtn (le bouton de vue) change d'état
     d'affichage selon la largeur, sa boîte ne peut donc pas être comparée. Tout le reste est
     comparé SANS exception : le bouton est masqué au-dessus de 1100 px, la zone de droite ne
     s'élargit plus, et ses enfants ne se décalent plus. */
  for (const e of avant) {
    if (e.exclu) continue;
    const f = carteB.get(e.c);
    if (!f) { uniques++; if (uniques <= 5) info(`  ${etiquette} · élément disparu`, e.c); continue; }
    compares++;
    if (e.b.some((v, i) => Math.abs(v - f.b[i]) > 0.5)) {
      ecartsBoite++;
      if (ecartsBoite <= 5) info(`  ${etiquette} · boîte modifiée`, `${e.c} : ${f.b.map(nombre).join(', ')} contre ${e.b.map(nombre).join(', ')}`);
    }
    if (e.s.some((v, i) => v !== f.s[i])) {
      ecartsStyle++;
      if (ecartsStyle <= 5) info(`  ${etiquette} · style modifié`, `${e.c} : ${stylesEcarts(e.s, f.s)}`);
    }
  }
  for (const e of apres) {
    if (e.exclu) continue;
    if (!carteA.has(e.c)) { uniques++; if (uniques <= 5) info(`  ${etiquette} · élément apparu`, e.c); }
  }
  auPlus(cat, `${etiquette} · écarts de boîte (sur ${compares} éléments)`, 0, ecartsBoite, 'élément(s)');
  auPlus(cat, `${etiquette} · écarts de styles calculés`, 0, ecartsStyle, 'élément(s)');
  auPlus(cat, `${etiquette} · éléments présents d’un seul côté`, 0, uniques, 'élément(s)');

  if (avecTopRight) {
    const ta = avant.find(e => e.topRight), tc = apres.find(e => e.topRight);
    if (ta && tc) {
      const droitA = ta.b[0] + ta.b[2], droitC = tc.b[0] + tc.b[2];
      egalA(cat, `${etiquette} · bord droit de .top-right conservé`, droitA, droitC, 0.5);
      /* Le bouton de vue est masqué au-dessus de 1100 px (décision de l'utilisateur : le
         bureau large reste identique au pixel). La zone de droite ne s'élargit donc plus du
         tout : elle doit retrouver EXACTEMENT sa largeur d'avant, et ses enfants avec elle. */
      egalA(cat, `${etiquette} · largeur de .top-right conservée`, ta.b[2], tc.b[2], 0.5);
    } else if (ta || tc) {
      ligne(false, cat, `${etiquette} · .top-right présente des deux côtés`, ta ? 'absente après' : 'absente avant', 'présente avant et après');
    }
    const ba = avant.find(e => /#themeBtn/.test(e.c)), bc = apres.find(e => /#themeBtn/.test(e.c));
    if (ba && bc) ligne(ba.b.every((v, i) => v === bc.b[i]), cat, `${etiquette} · boîte exacte de #themeBtn`,
      bc.b.map(nombre).join(', '), ba.b.map(nombre).join(', '));
  }
}

function stylesEcarts(a, c) {
  const noms = ['display', 'position', 'grid-template-columns', 'height', 'padding', 'margin', 'font-size', 'overflow-x', 'box-shadow'];
  const dits = [];
  a.forEach((v, i) => { if (v !== c[i]) dits.push(`${noms[i]} : « ${court(c[i])} » contre « ${court(v)} »`); });
  return dits.join(' ; ');
}

/* Critère 30 : rectangle à masquer = union des rectangles de .top-right des deux fichiers. */
function unionMasque(a, c) {
  if (a && !c) return { gauche: a.gauche, haut: a.haut, largeur: a.largeur, hauteur: a.hauteur };
  if (c && !a) return { gauche: c.gauche, haut: c.haut, largeur: c.largeur, hauteur: c.hauteur };
  if (!a && !c) return null;
  const gauche = Math.min(a.gauche, c.gauche), haut = Math.min(a.haut, c.haut);
  return {
    gauche, haut,
    largeur: Math.max(a.gauche + a.largeur, c.gauche + c.largeur) - gauche,
    hauteur: Math.max(a.haut + a.hauteur, c.haut + c.hauteur) - haut,
  };
}

async function comparerPixels(G, P, masque) {
  const fichierAvant = path.join(dossierPixels, `${G.code}-${P.code}-avant.png`);
  const fichierApres = path.join(dossierPixels, `${G.code}-${P.code}-apres.png`);
  /* La comparaison de pixels recharge les deux pages : le gabarit doit être celui de la
     ligne en cours, et non le dernier posé par la boucle de mesure. */
  await p.setViewport({ width: G.l, height: G.h, deviceScaleFactor: 1 });
  await attendre(200);
  /* Les animations CSS (le point « en direct » qui clignote) dépendent de l'horloge des
     animations, que les deux captures ne partagent pas. On les remet au temps 0 des deux
     côtés avant la capture : sans cela la comparaison de pixels est instable. */
  const figerAnimations = () => p.evaluate(() => {
    try { document.getAnimations().forEach(a => { a.pause(); a.currentTime = 0; }); } catch (e) {}
  });
  /* Les minuteries de la page (tick et refreshLive toutes les 3 s, synchro du pont) peuvent
     réécrire le direct entre les deux captures : on les arrête, des deux côtés, juste avant
     la capture. Rien n'est encore à dessiner à ce moment-là. */
  const figerMinuteries = () => p.evaluate(() => {
    try {
      const dernier = setInterval(() => {}, 60000);
      for (let i = 0; i <= dernier; i++) clearInterval(i);
    } catch (e) {}
  });
  try {
    const preparerCapture = async () => {
      await defilerTout();
      await attendre(300);          // laisse le tracé des graphiques se terminer
      await figerAnimations();
      await figerMinuteries();
      await attendre(120);
    };
    await charger(urlReference, 900);
    const routeAvant = await allerPage(P);
    await preparerCapture();
    await p.screenshot({ path: fichierAvant, fullPage: true });
    await charger(cibleMesuree, 900);
    const routeApres = await allerPage(P);
    await preparerCapture();
    await p.screenshot({ path: fichierApres, fullPage: true });
    if (routeAvant !== P.hash || routeApres !== P.hash) {
      info(`  ${G.code}/${P.code} · captures`, `route non atteinte (${routeAvant} / ${routeApres}) : comparaison abandonnée`);
      return null;
    }
    const A = lirePng(fs.readFileSync(fichierAvant));
    const B = lirePng(fs.readFileSync(fichierApres));
    if (A.largeur !== B.largeur || A.hauteur !== B.hauteur) {
      return { differents: -1, largeur: A.largeur, hauteur: A.hauteur };
    }
    const etatA = etatPng(A), etatB = etatPng(B);
    let differents = 0;
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let y = 0; y < A.hauteur; y++) {
      const la = lignePng(A, etatA), lb = lignePng(B, etatB);
      const dansMasque = masque && y >= Math.floor(masque.haut) && y < Math.ceil(masque.haut + masque.hauteur);
      const mx0 = dansMasque ? Math.floor(masque.gauche) : 0;
      const mx1 = dansMasque ? Math.ceil(masque.gauche + masque.largeur) : 0;
      for (let x = 0; x < A.largeur; x++) {
        if (dansMasque && x >= mx0 && x < mx1) continue;
        const o = x * A.canaux;
        if (la[o] !== lb[o] || la[o + 1] !== lb[o + 1] || la[o + 2] !== lb[o + 2]
          || (A.canaux === 4 && la[o + 3] !== lb[o + 3])) {
          differents++;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    fs.rmSync(fichierAvant, { force: true });
    fs.rmSync(fichierApres, { force: true });
    return {
      differents, largeur: A.largeur, hauteur: A.hauteur,
      boite: differents ? { x0, y0, x1, y1 } : null,
    };
  } catch (e) {
    info(`  ${G.code}/${P.code} · captures`, `échec : ${e.message}`);
    return null;
  }
}

/* Décodage PNG minimal (8 bits, sans entrelacement) : zlib de la bibliothèque standard et
   les cinq filtres de la spécification PNG, pour comparer deux captures sans dépendance. */
function lirePng(tampon) {
  if (tampon.length < 8 || tampon.readUInt32BE(0) !== 0x89504e47) throw new Error('ce n’est pas un PNG');
  let pos = 8, entete = null;
  const morceaux = [];
  while (pos + 8 <= tampon.length) {
    const taille = tampon.readUInt32BE(pos);
    const type = tampon.toString('ascii', pos + 4, pos + 8);
    const donnees = tampon.subarray(pos + 8, pos + 8 + taille);
    if (type === 'IHDR') {
      entete = {
        largeur: donnees.readUInt32BE(0), hauteur: donnees.readUInt32BE(4),
        profondeur: donnees[8], type: donnees[9], entrelace: donnees[12],
      };
    } else if (type === 'IDAT') morceaux.push(donnees);
    else if (type === 'IEND') break;
    pos += 12 + taille;
  }
  if (!entete) throw new Error('en-tête IHDR absent');
  const canaux = entete.type === 6 ? 4 : entete.type === 2 ? 3 : entete.type === 4 ? 2 : entete.type === 0 ? 1 : 0;
  if (!canaux) throw new Error(`type de couleur PNG non géré (${entete.type})`);
  if (entete.profondeur !== 8) throw new Error(`profondeur PNG non gérée (${entete.profondeur} bits)`);
  if (entete.entrelace) throw new Error('PNG entrelacé non géré');
  return {
    largeur: entete.largeur, hauteur: entete.hauteur, canaux,
    largeurLigne: entete.largeur * canaux,
    brut: zlib.inflateSync(Buffer.concat(morceaux)),
  };
}
function etatPng(img) {
  return { i: 0, precedente: Buffer.alloc(img.largeurLigne), pas: img.largeurLigne + 1, canaux: img.canaux };
}
function lignePng(img, etat) {
  const debut = etat.i * etat.pas;
  const filtre = img.brut[debut];
  const source = img.brut.subarray(debut + 1, debut + 1 + img.largeurLigne);
  const sortie = Buffer.alloc(img.largeurLigne);
  const prec = etat.precedente, n = etat.canaux;
  for (let x = 0; x < img.largeurLigne; x++) {
    const a = x >= n ? sortie[x - n] : 0;
    const bp = prec[x];
    const c = x >= n ? prec[x - n] : 0;
    let v = source[x];
    if (filtre === 1) v += a;
    else if (filtre === 2) v += bp;
    else if (filtre === 3) v += (a + bp) >> 1;
    else if (filtre === 4) {
      const p = a + bp - c, pa = Math.abs(p - a), pb = Math.abs(p - bp), pc = Math.abs(p - c);
      v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bp : c);
    }
    sortie[x] = v & 0xff;
  }
  etat.precedente = sortie;
  etat.i++;
  return sortie;
}
