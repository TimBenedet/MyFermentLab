# Notes — second design « Run Lab » du dashboard

Fichier modifié : `scada-opus-5.5/hakko-dashboard.html`. Aucun autre fichier du dépôt n'a été touché
à part ces notes.

## Ce qui a été fait

### 1. Trois ajouts, et seulement trois

| Ajout | Où | Taille |
|---|---|---|
| Un bouton `#runlabBtn` | `header.topbar > .top-right`, après le bouton de thème | 1 ligne de balisage |
| Un `<script>` de bascule autonome | dans `<head>`, juste après le script « Vue téléphone » | 11 lignes de code |
| Un bloc CSS sous `html.runlab` | en fin de `<style>`, après les règles de `#vueBtn` | ~150 règles |

**Aucune ligne existante n'est modifiée.** Vérifié par empreinte SHA-256 avant et après :

- script « Vue téléphone » (1 096 caractères) : `593e4d4ddedefaf3`, identique ;
- script principal (99 271 caractères : régulation, pont, rendu) : `7ab19f224c28898a`, identique ;
- feuille de style d'origine (tout ce qui précède le bloc ajouté) : `1a49340c54c80a9f`, identique ;
- zéro `!important` dans le fichier ;
- fins de ligne CRLF conservées (le fichier était en CRLF).

### 2. La bascule

Elle reprend le mécanisme de la vue téléphone (une classe sur `<html>`, posée dans `<head>` avant la
première image pour éviter un éclair du mauvais design, et un choix gardé dans `localStorage`) :

- clé `hakko-design`, valeur `runlab` ; revenir au design par défaut **efface** la clé, comme
  `hakko-vue` ;
- `aria-pressed` est synchronisé au chargement (`DOMContentLoaded`) et à chaque clic ;
- `<meta name="theme-color" content="#0A0A0C">` est **créé** quand Run Lab est actif et **retiré**
  sinon. La page d'origine n'avait pas de `theme-color` : le design par défaut reste donc sans
  cette balise, comme avant ;
- son écouteur de clic est à part et ne réagit qu'à `#runlabBtn`. Le bouton n'a pas de
  `data-action` : le gestionnaire de clic existant l'ignore (`closest('[data-action]')` renvoie
  `null`), donc aucun `render()` et aucun `tick()` ne sont déclenchés ;
- aucune donnée, aucun appareil ni aucun appel au pont ne sont lus ou écrits. Les graphiques SVG
  prennent leurs couleurs dans des `var(--…)` en `style=`, donc ils changent de palette sans être
  redessinés.

### 3. Le design

Palette, surfaces, échelle typographique et formes reprises du canevas de référence :

- surfaces `#0A0A0C` (fond), `#131317` (cartes), bordure `#1F1F24`, lignes internes `#1A1A1F` ;
  rayon 16 px, aucune ombre ;
- accents : cyan `#4FC3F7` (accent, focus, bouton principal), vert `#34D399` sur `#0F2E22` (OK),
  ambre `#FFC93C` (écart léger, bière), violet `#9C8CF5` (miso), lime `#A8E063` (koji),
  rose `#FF2E7E` (garum, uniquement en forme) ;
- le texte « hors plage / hors ligne » utilise un rose éclairci `#FF5C93`, parce que `#FF2E7E`
  n'atteint que 4,64:1 sur `#1F1F24` ;
- titres 17 px gras blancs, avec la date ou le sous-titre en capitales 10 px **au-dessus** (comme
  « TUESDAY · 04 MAR » de la référence) ;
- libellés en capitales 10 px, lettrage 1,5 px ; grande valeur 32 px (28 px dans les rangées
  compactes du détail et de l'accueil) ; unité 13 px `#B8BCC4` ; ligne secondaire 11 px ;
- police : pile système (`system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`), sans rien
  télécharger ; chiffres tabulaires sur toute la page.

Correspondance forme et donnée réelle :

| Forme de la référence | Ce qui la porte dans le dashboard |
|---|---|
| Grand chiffre | Température du lot (carte de lot : pleine largeur, 32 px), KPI « Appareils en ligne », « Chauffe active », etc. |
| Barres horizontales de 8 px, valeur à droite | Progression de chaque lot (le % était déjà aligné à droite au-dessus de la barre) et batteries des sondes |
| Barres verticales arrondies | Bande « Progression » du détail d'un lot : un jour (ou 4 h, ou une semaine) par barre. Les barres passées sont éteintes mais lisibles (`#6B7280`, 3,83:1), celle du jour est en couleur du lot et plus haute, les suivantes sont au trait. La **hauteur** dit l'état autant que la couleur. |
| Badges en pastille teintée | Tous les `.badge` : « Dans la cible », « Écart léger », « Hors plage », « En ligne », « Hors ligne », « Chauffe on/off »… |
| Barre d'onglets en bas | La `.tabbar` existante (Accueil, Archive, Recettes, Appareils) : de vraies routes. Capitales 10 px, onglet courant en cyan **et** marqué d'un point |
| Pastilles d'appareil | Les cinq prises de la multiprise : carte creusée, voyant vert plein allumé et anneau gris éteint, bordure pointillée et mention « · hors ligne » si la prise ne répond pas. **Les boutons ON / OFF existants sont gardés** tels quels : même balisage, mêmes gestionnaires. OFF est une pilule sombre cerclée, ON une pilule verte à texte noir |

Autres points :

- le bouton de thème est **masqué** en Run Lab : ce design est sombre par nature, le bouton ne
  changerait rien à l'écran. Il revient dès qu'on quitte Run Lab ;
- les champs ont un fond creusé `#0A0A0C` et un bord `#6B7280` (≥ 3,39:1 sur toutes les
  surfaces). Le bord passe en cyan au focus ;
- boutons segmentés : le bouton enfoncé passe en blanc à texte noir, pas seulement en teinte ;
- `:focus-visible` : contour cyan 2 px partout. Dans `.seg`, `.stepper` et `.tabs`, qui ont un
  `overflow` qui rognerait le contour, il est rentré de 3 px ;
- `prefers-reduced-motion: reduce` : transitions et animations coupées sous `html.runlab`, et plus
  d'effet d'enfoncement sur les boutons ON / OFF.

### Contrastes calculés (formule WCAG, calcul fait en Python)

| Couleur | sur `#0A0A0C` | `#131317` | `#1A1A1F` | `#1F1F24` |
|---|---|---|---|---|
| libellé `#8A8F98` | 6,09 | 5,70 | 5,33 | 5,05 |
| secondaire `#A3A8B0` | 8,28 | 7,75 | 7,25 | 6,86 |
| unité `#B8BCC4` | 10,39 | 9,73 | 9,10 | 8,62 |
| cyan `#4FC3F7` | 9,87 | 9,25 | 8,65 | 8,19 |
| rouge d'état `#FF5C93` | 6,79 | 6,36 | 5,95 | 5,63 |
| bord / barre éteinte `#6B7280` (interface, seuil 3:1) | 4,09 | 3,83 | 3,59 | 3,39 |

Pastilles : vert sur `#0F2E22` 7,62 ; ambre sur `#33280A` 9,44 ; rose `#FF5C93` sur `#3A0F20`
5,68. Texte noir `#0A0A0C` sur cyan 9,87 et sur vert 10,29.

## Ce que je n'ai pas pu faire

- **L'anneau de progression « chauffe active : durée écoulée sur 45 min ».** Cette durée
  (`d.regulDepuis`) existe dans l'état JavaScript mais **n'est écrite nulle part dans le DOM**. La
  lire demanderait du JavaScript qui touche aux données de régulation, ce qu'interdit le brief. Du
  CSS seul ne peut pas lire un `style="width:…"` pour en faire un `conic-gradient`. Je n'ai donc
  **pas** dessiné d'anneau plutôt que d'en inventer un. Pour le faire proprement, il faudrait que
  le rendu existant expose la durée (par exemple une variable `--chauffe` sur la prise), et c'est
  une modification de la logique à décider à part.
- **Les barres verticales « écarts à la consigne, lot par lot » ou « en ligne / hors ligne ».** Même
  raison : ces séries ne sont pas dans le DOM sous forme de barres. J'ai mis la forme sur la seule
  série discrète déjà rendue, la bande de progression (voir le tableau).
- **Les libellés `Running` → `En chauffe`, `Idle` → `Au repos`.** Le dashboard affiche déjà
  « Active » / « Veille » (KPI Chauffage), « Chauffe on / off » (journal), « Dans la cible »,
  « Écart léger », « Hors plage », « En ligne », « Hors ligne ». Le brief demande « mêmes
  libellés » et interdit de toucher au JavaScript qui les produit : je les ai gardés.
- **Aucune vérification visuelle.** Il n'y a ni Node ni navigateur dans cet environnement. Rien n'a
  été rendu, capturé ni mesuré à l'écran. Les seules vérifications réellement faites : empreintes
  du JavaScript et du CSS d'origine, absence de `!important`, portée de tous les sélecteurs ajoutés
  (tous commencent par `html.runlab`), et calcul des contrastes.

## Ce que j'ai dû interpréter

1. **Le bouton ne disparaît nulle part.** Le bouton « Vue téléphone » est masqué là où il ne sert à
   rien (sur tactile, la vue mobile s'applique d'elle-même) et au-dessus de 1 100 px, pour garder la
   barre du bureau intacte. Un choix de design, lui, a un sens partout, y compris au téléphone,
   pour lequel ce design est pensé. Je l'ai donc laissé visible partout. Conséquence connue : au
   bureau, dans le design par défaut, la zone de droite de la barre du haut s'élargit de 48 px.
   C'est l'exception « à part le nouveau bouton » prévue par la vérification d'images.
2. **Couleurs par type de lot.** Bière en ambre, miso en violet, koji en lime, garum en rose.
   L'ambre de la bière est aussi celui de « Écart léger », et le rose du garum est proche du rouge
   d'état. Le type est toujours écrit à côté de sa pastille, et l'état toujours écrit dans son
   badge : aucune information ne repose sur la seule couleur.
3. **Carte de lot.** La température passe seule sur la première ligne en 32 px (« le grand
   chiffre »), et la cible et la troisième mesure sur deux colonnes en dessous. Sur trois colonnes,
   « 21,3 °C » en 32 px ne tenait pas dans une carte de 250 px.
4. **Imbrication.** Les lots et les prises sont dans une carte. Ils prennent le fond `#0A0A0C`
   (creusé) plutôt qu'une troisième surface plus claire, pour garder la hiérarchie « par écart de
   surfaces » sans ombre.
5. **La référence.** L'image `design/captures/reference-run-lab.png` a pu être ouverte. Je n'en ai
   tiré que le style : le graphique de rythme en courbe, lui, n'a pas d'équivalent dans le brief.
   Les courbes de température existantes du détail d'un lot sont restées telles quelles, avec la
   palette sombre.

### Écarts entre le brief et le fichier réel, à signaler

Le brief cite des noms qui **n'existent pas** dans `hakko-dashboard.html` : `/api/commande`,
`REGUL_PAGE_CLE`, `d.allume`, un palier de 90 minutes. Le fichier utilise `api/etat` et `api/prise`,
`REGUL_CLE`, `d.on`, `AUTO_MAX_ON = 45 min`. Le palier de 90 minutes, lui, est côté pont, pas dans
cette page. Rien de tout cela n'a été touché. Pour relire, cherchez les vrais noms :
`pontRequete('prise'`, `regulerPont`, `regulerSecurite`, `regulMaitre`, `REGUL_CLE`, `d.demo`,
`AUTO_MAX_ON`.

Le fichier d'origine charge déjà IBM Plex Sans depuis Google Fonts (`<link>` en tête). Je n'ai rien
ajouté d'externe. Le design Run Lab n'utilise pas cette police, donc il n'en dépend pas.

## Vérifications à faire ailleurs (navigateur requis)

Je n'ai lancé ni test ni page. Aucune commande n'a été envoyée, puisque rien n'a été exécuté.

Pour tout essai : ouvrir la page **en `file://`**. `PONT_LOCAL` y coupe toute requête. Ou bien
bloquer `api/prise` dans les outils réseau avant de charger, et ne **jamais** cliquer sur ON / OFF
ni sur un interrupteur de prise.

1. **Différence d'images du design par défaut**, avant et après, à 1 440 × 900, 1 000 × 800 et
   390 × 844. Seul le nouveau bouton doit apparaître (et décaler les boutons voisins de 48 px).
   Clé `hakko-design` absente du `localStorage`.
2. **Diff du JavaScript** : `git diff` du fichier. Attention, le fichier est en CRLF et la copie de
   travail montre déjà une différence de fins de ligne sur tout le fichier : utiliser
   `git diff --ignore-cr-at-eol`. Seuls le bloc `<script>` Run Lab, la ligne du bouton et le bloc
   CSS final doivent apparaître.
3. **Contrastes réels** du design Run Lab : texte des badges, libellés 10 px, placeholder (forcé en
   `#8A8F98`), lignes secondaires des KPI.
4. **Débordement à 390 px et à 320 px** en Run Lab : KPI « Min / max » de l'archive (valeur longue
   en 28 px, coupure autorisée), onglet « APPAREILS » de la barre du bas en capitales, en-têtes
   de tableaux en capitales (le tableau défile horizontalement au bureau).
5. **Zones tactiles** en Run Lab dans la vue téléphone forcée (430 px) et sous 900 px : onglets du
   bas (52 px), boutons ON / OFF (44 px), `#runlabBtn` (zone de 44 × 44 par le `::before` existant
   des `.icon-btn`).
6. **Clavier** : Tab jusqu'au bouton, Entrée ou Espace pour basculer, `aria-pressed` qui suit, contour
   de focus visible sur les segments et le pas-à-pas de consigne. Recharger : le choix est
   conservé. Rebasculer : retour exact au premier design, bouton de thème revenu, `theme-color`
   retiré.
7. **Sans fin de contenu masquée** : faire défiler jusqu'en bas en Run Lab sous 900 px. Le dernier
   élément doit rester au-dessus de la barre d'onglets.
8. **`prefers-reduced-motion`** émulé : aucune transition en Run Lab.
9. **`:has()`** (espacement de la bande de progression quand elle compte 30 cases ou plus) : sans
   support, l'écart reste de 3 px. Ce n'est pas bloquant. `:not(.stepper input)` exige un
   navigateur récent (Chrome 88, Safari 9, Firefox 84).
10. **Lecture sans commande** : ouvrir en `file://`, parcourir Accueil, un lot, Appareils (onglet
    Prises), Archive, dans les deux designs, en surveillant l'onglet Réseau. Aucune requête vers
    `api/prise` ne doit partir. En `file://`, `pontSynchro` ne fait même pas `api/etat`.
