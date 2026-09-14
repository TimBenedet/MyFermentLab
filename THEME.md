# THEME — Palette et langage visuel

Tout le thème est déclaré dans `src/index.css`, bloc `@theme` (Tailwind v4).
Il n'y a **ni `tailwind.config.js` ni `postcss.config.js`** : le plugin
`@tailwindcss/vite` lit ces variables et génère les utilitaires correspondants.

> Règle absolue : les classes sont écrites **en toutes lettres**. Aucune classe
> construite par concaténation, sinon Tailwind ne la génère pas.

> Ce document décrit le thème **sombre**, celui par défaut et le seul détaillé
> ci-dessous. Le thème **clair** ne change aucun composant : voir « Deux thèmes »
> en fin de document.

## Surfaces anthracite

Échelle bleutée, du fond de page vers les éléments actifs. La progression est
monotone : plus le numéro est bas, plus la surface est claire.

| Variable | Valeur | Usage |
|---|---|---|
| `--color-anthracite-950` | `#0b1117` | fond de page |
| `--color-anthracite-900` | `#131b24` | panneaux, cartes, figures |
| `--color-anthracite-850` | `#1a2431` | surfaces élevées, en-têtes de section, survol |
| `--color-anthracite-800` | `#223040` | séparateurs internes, pastilles neutres |
| `--color-anthracite-700` | `#2b3a4d` | bordures |

Utilitaires générés : `bg-anthracite-900`, `border-anthracite-700`, etc.
Les bordures de panneaux utilisent `border-anthracite-700/70` : un filet adouci
qui laisse l'ombre porter la séparation.

## Surfaces plates et rayon

**Aucune ombre portée.** La hiérarchie ne tient qu'aux fonds et à un filet :
page `#0b1117`, panneaux `#131b24`, bordure `border-anthracite-800`.

- **Panneaux** (cartes, regroupements Devices, graphes) : `rounded-xl` + `border border-anthracite-800 bg-anthracite-900`.
- **Contrôles** (boutons, champs, tooltip, onglets, pastilles d'icône) : `rounded-lg`.
- **Pastilles d'état et bascules** : `rounded-full`.

Le **chrome n'est pas un panneau** : la barre latérale et les en-têtes de vue
n'utilisent qu'un filet (`border-b` / `border-r`), sans fond opaque ni arrondi.
C'est ce qui sépare la coque du contenu, à la place de l'ombre.

## Accent

**Un seul accent, réservé à l'interaction** — jamais décoratif.

| Variable | Valeur |
|---|---|
| `--color-accent-300` | `#7dd3fc` |
| `--color-accent-400` | `#38bdf8` |
| `--color-accent-500` | `#0ea5e9` |

Usages : onglet actif (`bg-accent-500/15` + `ring-accent-500/40`),
focus, survol des bordures de carte (`hover:border-accent-500/50`),
chevron au survol.

## Une teinte par grandeur suivie

Ces teintes servent au **trait**, à l'**aire sous la courbe**, à la **pastille de
légende** et à la **valeur** de la grandeur. Les **consignes restent en gris neutre**
(`#5f646c`) : ce sont des références, pas des mesures.

| Grandeur | Hex | Utilitaire de texte |
|---|---|---|
| Température | `#7fb2ff` | `text-metric-temperature` |
| Humidité | `#4fd1c5` | `text-teal-300` |
| Densité | `#a78bfa` | `text-violet-300` |

En thème clair ces trois teintes s'assombrissent (`#2563eb`, `#0d9488`, `#7c3aed`) :
un bleu 300 ou un turquoise 300 ne se lit pas sur blanc. Voir « Deux thèmes ».

## États

**Vert, ambre et rouge sont réservés aux états** — jamais décoratifs.
Source unique : `STATUS_STYLES` dans `src/lib/status.ts`.

| État | Libellé | `dotClass` | `textClass` | `pillClass` | Hex |
|---|---|---|---|---|---|
| `ok` | Nominal | `bg-emerald-500` | `text-emerald-400` | `bg-emerald-500/10 ring-1 ring-emerald-500/30` | `#10b981` |
| `warn` | Dérive | `bg-amber-500` | `text-amber-400` | `bg-amber-500/10 ring-1 ring-amber-500/30` | `#f59e0b` |
| `alarm` | Alarme | `bg-red-500` | `text-red-400` | `bg-red-500/10 ring-1 ring-red-500/30` | `#ef4444` |

Les pastilles d'état (`StatusDot`) utilisent `pillClass` + `textClass` : un fond
teinté à 10 % et un anneau à 30 %, jamais un aplat saturé. Les bascules On/Off
des prises suivent le même principe, en vert et rouge.

### Règle de couleur

**La couleur d'état n'apparaît que dans la pastille.** Les gros chiffres sont en
`text-zinc-100`, les écarts en `text-zinc-400`. Un écart hors bande se lit donc
sur la pastille, pas sur la couleur du nombre — plus sobre, et c'est un choix
assumé contre le « lisible à trois mètres » de la spec d'origine.

**Les teintes de grandeur restent**, elles : turquoise pour l'humidité, violet
pour la densité. Elles n'expriment pas un état mais **identifient la mesure**, et
c'est ce qui permet de retrouver une courbe dans un graphe sans lire son titre.

La **bande nominale** des graphes réutilise `STATUS_STYLES.ok.hexColor` avec
`fillOpacity 0.14` : c'est elle qui rend la zone lisible d'un coup d'œil.

### Axe des ordonnées

Le domaine vertical est **calculé puis imposé** à Recharts (`domain={[min, max]}`),
et les graduations sont **générées à pas rond** (`niceTicks`, `src/components/MetricChart.tsx`)
plutôt que laissées à Recharts.

Sans cela, Recharts tire ses propres « nice values » et **élargit le domaine** pour
les faire tenir. Sur une consigne à 19,5 °C l'axe partait de 19,0 et montait à 19,9
alors que la mesure vivait entre 19,3 et 19,7 : la courbe se tassait dans le tiers
central d'un graphe à moitié vide, avec des graduations irrégulières
(19,9 / 19,8 / 19,5 / 19,3 / 19,0). Le domaine imposé donne 19,2 / 19,4 / 19,6 / 19,8.

Hauteur maximale d'un graphe : **aucune**. Voir « Aligner les deux bas de
section » plus bas — un plafond recrée un vide sous les graphes.

## Vue produit : équilibrer les deux colonnes

La colonne de gauche (208 px, la largeur de la barre latérale) est en
`lg:self-start` : elle prend la hauteur de son contenu, jamais celle de la page.
Elle contient, dans l'ordre : l'illustration du contenant, son libellé, le chiffre
de tête et son écart, les relevés, puis la **synthèse « Sur 24 h »**.

Cette synthèse est ce qui tient la mise en page : sans elle la colonne faisait
376 px pour 690 px de hauteur disponible et laissait **un trou de 360 px en bas à
gauche**. Elle porte la moyenne et l'amplitude de chaque canal, jamais le min/max,
qui reste dans la note sous chaque graphe — sinon les deux se répètent.

**Deux canaux au maximum** (température, puis humidité *ou* densité) : à trois
blocs la colonne devient plus haute que les graphes et la page se met à défiler
à 1024 × 640.

## Commande de consigne

`SetpointControl` (champ, boutons `+` / `−`, `Valider`) vit dans la colonne de
gauche, entre le chiffre de tête et les relevés. Il remplace la ligne `Consigne`
des relevés — un seul endroit affiche la cible.

- **Pas de 0,5 °C.** La bande nominale fait 0,2 °C : 1 °C est trop grossier,
  0,1 demande 25 clics pour un écart utile. Bornes 4 à 45 °C.
- **La saisie est un brouillon.** Rien ne part au moteur avant `Valider`.
  Entrée valide, Échap annule le brouillon.
- **Échap doit être `stopPropagation`** : `App` écoute Échap sur `window` pour
  fermer la vue produit. Sans ça, annuler la saisie fermait aussi la page.
- **`rétablir`** apparaît dans l'en-tête du bloc dès que la consigne diffère de
  celle de `src/config/fermentations.ts`.
- La consigne vit **en mémoire** : un rechargement de page repart des valeurs de
  la config. C'est un choix, pas un oubli.

## État de régulation

`RegulationStatus` ferme la colonne de gauche : une pastille pleine largeur, puis
la vitesse de variation. L'état est déduit de l'écart à la consigne, avec une
**bande morte de 0,1 °C** (la moitié de la bande nominale).

| État | Condition | Couleur |
|---|---|---|
| **Chauffe** | écart < −0,1 °C | rouge |
| **Refroidissement** | écart > +0,1 °C | bleu température |
| **À consigne** | \|écart\| ≤ 0,1 °C | émeraude |

**Le code couleur est celui du geste, pas de l'état du ferment.** Une résistance
qui chauffe est rouge même quand la cuve est parfaitement nominale, et la pastille
rouge peut donc cohabiter avec une pastille verte en en-tête. C'est voulu : l'une
dit ce que fait la machine, l'autre où en est le produit.

**Vitesse en °C/h sur 15 minutes**, pas sur une heure : le cycle de régulation
dure 57 min, donc sur une heure pleine un aller-retour s'annule et la mesure ne
dirait rien.

## Deux propositions de fiche produit (`v1` / `v2`)

Le bouton **V2** de l'en-tête bascule la vue produit entre deux compositions. L'état vit
dans `App.tsx` : il survit à un retour à l'accueil, sinon la comparaison est impossible.

| | `v1` — actuelle | `v2` — minimaliste |
|---|---|---|
| Structure | colonne de gauche de 224 px + graphes | **bandeau de 56 px**, graphes pleine largeur |
| Encadrés | 1 panneau + 1 bloc de commande + 1 pastille pleine | **aucun** |
| Séparateurs | 6 filets | **aucun** |
| Éléments du bandeau | 7 blocs | **3** : chiffre de tête, état de régulation, commande de consigne |
| Illustration | bloc de 160 px sur sa propre ligne | **vignette de 56 px**, à côté du chiffre |
| Relevés | 3 lignes dans la colonne | **dans l'en-tête de la courbe concernée** |
| Synthèse 24 h | tableau de 3 lignes | **dans la note sous la courbe** |
| Largeur des graphes | 904 px à 1379 | **1123 px** |
| Hauteur des graphes | 332 px | 337 px |

**Le principe de `v2`** : *un chiffre, un seul endroit — celui où on le lit.* La fiche ne
redit pas ce que les graphes portent déjà :

- l'humidité courante `76,2 %` s'affiche **dans l'en-tête du graphe d'humidité**, à côté
  de sa consigne ;
- sa moyenne et son amplitude passent **dans la note sous ce même graphe** —
  `moy 75,2 % · amp 9 pts · min 71 % · max 80 % · écart +1,2 pts` ;
- la température, elle, reste dans le bandeau : c'est le chiffre de tête du ferment.

Concrètement, le bandeau ne contient plus que `18,0 °C −0,03 · ● À consigne +0,3 °C/h ·
Consigne − 18,0 +`. Les relevés et la synthèse ne sont pas supprimés : ils ont déménagé
à côté de la courbe qu'ils décrivent.

**Pourquoi ce déménagement.** Une colonne minimaliste ferait ~350 px de haut pour 755 px
disponibles : il ne resterait qu'à répartir 400 px en gouttières de 130 px, ce qui n'est
plus de l'air mais un trou. En passant à l'horizontal, le contenu garde sa taille
naturelle et **les graphes récupèrent 220 px de large**.

Le bandeau est en `flex-wrap` : il tient sur une ligne dès 1024 px (768 px de contenu),
et se replierait sur deux lignes en dessous.

## Où vit quoi

La colonne de gauche porte **tout le ferment** : contenant, valeur courante,
commande de consigne, relevés, état de régulation, synthèse « Sur 24 h ». La
colonne de droite ne porte que les graphes.

### Aligner les deux bas de section

Un seul réglage : **la rangée remplit la hauteur disponible** (`flex-1 min-h-0`)
et **la colonne de gauche s'étire** à la même hauteur. Les deux bas de section
coïncident alors par construction, à toutes les tailles.

Résultat mesuré : écart entre le bas du panneau et le bas des graphes = **0 px**,
et **12 px entre le bas du contenu et le bas de la fenêtre** — la même valeur
qu'entre le haut de la fenêtre et l'en-tête — à 1024×640, 1280×700, 1479×760,
1379×832 et 1920×1080.

Deux tentations à ne pas reprendre, essayées puis abandonnées :

- **Plafonner la rangée** (`max-h`) pour éviter des graphes trop hauts : cela
  recrée un trou en bas, d'autant plus grand que l'écran est haut, et déséquilibre
  la composition.
- **Plafonner les graphes** : les graphes plafonnent alors avant la rangée,
  laissent un trou sous eux, et le bas des deux colonnes se décale.

Conséquence assumée : la hauteur des graphes suit celle de l'écran — environ
275 px à 640 de haut, 371 px à 832, 495 px à 1080. C'est le prix de l'absence de
vide. Le plancher de 120 px sur la zone de tracé protège les petits écrans.

### Contrainte de hauteur

À 1024 × 640 la colonne de gauche dispose de **566 px**, et son contenu doit y
tenir *entièrement* : c'est elle qui détermine si la page défile. Toute addition
doit donc être financée. C'est ce qui a fait :

- sortir la ligne `Consigne` des relevés quand la commande est arrivée ;
- passer la synthèse en **tableau à 3 lignes** (libellé, moyenne, amplitude)
  plutôt qu'en 6 lignes de `MetricRow` — 63 px au lieu de 104.

## Typographie

- **Le `font-mono` est réservé à une seule chose** : les identifiants bruts
(`entity_id`, motifs de sélection de famille). C'est la règle sans exception :
*le mono, c'est pour ce qu'on lit caractère par caractère, pas pour ce qu'on lit
d'un coup d'œil*. À `text-4xl`, la chasse fixe donnait à la virgule une cellule
entière — un « 19 , 6 » troué, qui pesait plus lourd que tout le reste de la carte.
- **Tous les nombres** — chiffres de tête compris — en sans-serif + `tabular-nums` :
les chiffres restent alignés d'un tick à l'autre sans le look dactylo.
- **Les libellés** en casse normale, `text-[10px]` à `text-[13px]`. Les majuscules
espacées (`uppercase tracking-[0.14em]`) ont été abandonnées : elles donnaient un
aspect technique et daté.
- Titres : `text-[15px]` (barre latérale) et `text-lg` (vue produit, Devices).
- **Mesures principales** : `text-2xl` sur les cartes comme en vue détaillée.
- **Relevés et libellés de relevés** : `text-[12px]` / `text-[11px]` (`MetricRow`),
rythme `py-0.5`.
- Nombres au format `fr-FR` (virgule décimale, signe moins `−` U+2212).

## Animation

Une seule animation pour tout le projet :

```css
--animate-bubble: bubble-rise 6s linear infinite;
```

`bubble-rise` fait remonter les bulles (`translateY(0) scale(.6)` →
`translateY(-86px) scale(1.15)`, opacité 0 → 0,9 → 0,5 → 0). Elle est **toujours**
doublée de `motion-reduce:animate-none`.

Les éléments animés reçoivent `transform-box: fill-box` et `transform-origin: center`
en style inline, sinon le `scale` s'applique par rapport au centre du `viewBox` et
les bulles se déplacent.

Le miso n'est jamais animé : une pâte solide ne fait pas de bulles.

## Deux thèmes : sombre (défaut) et clair

Le thème clair — des blancs : page à peine bleutée, cartes blanches — ne change
**aucun composant**. `src/index.css` redéfinit les variables de `@theme` sous
`html[data-theme='light']`, et toutes les classes littérales des composants
(`bg-anthracite-900`, `text-zinc-100`, `text-emerald-400`…) suivent d'elles-mêmes.
C'est la raison du choix : la règle « pas de classe construite » interdit un
utilitaire calculé, mais une variable CSS redéfinie ne coûte rien à personne.

La bascule est un bouton dans le **pied de la barre latérale** (`ThemeToggle`), sur
la ligne du rafraîchissement : le chrome n'est pas un panneau, le bouton l'est encore
moins. Il **annonce la destination et non l'état** — soleil tant qu'on est en sombre,
lune en clair — et son libellé `aria-label` dit la même chose. Le choix est mémorisé
(`localStorage`, clé `fermentation4.theme`) et posé sur `<html>` **avant le premier
rendu**, dans `main.tsx`, sinon la page s'affiche un instant dans l'autre thème.

### Ce qui s'inverse

| Rôle (variable) | Sombre | Clair | Pourquoi |
|---|---|---|---|
| fond de page (`--color-anthracite-950`) | `#0b1117` | `#eaeff7` | en clair la page redevient la plus sombre des trois surfaces |
| panneaux, cartes (`--color-anthracite-900`) | `#131b24` | `#ffffff` | les panneaux passent au blanc pur |
| survol, surfaces élevées (`--color-anthracite-850`) | `#1a2431` | `#f2f5fa` | un voile gris très clair sur le blanc |
| filets internes (`--color-anthracite-800`) | `#223040` | `#dbe3ee` | doit tenir sur le blanc **et** sur le fond de page |
| bordures (`--color-anthracite-700`) | `#2b3a4d` | `#c8d3e6` | même contrainte, pour les contrôles |
| encre `zinc-100` → `zinc-600` | `#f4f4f5` → `#52525b` | `#0f172a` → `#8592a6` | cette échelle porte le texte : elle s'assombrit au lieu de s'éclaircir |

La progression de la rampe anthracite — « plus le numéro est bas, plus la surface est
claire » — ne vaut qu'en sombre. En clair l'ordre est *page teintée → carte blanche →
survol gris clair* : la carte ne se lit plus par sa luminosité mais par son filet, ce
qui est déjà le langage du projet. Aucune ombre n'a été ajoutée pour compenser.

L'échelle `zinc` est redéfinie, pas remplacée par des jetons sémantiques : les
composants l'utilisent déjà comme une rampe de texte, et l'inverser suffit.

### Ce qui s'assombrit sans s'inverser

États, grandeurs et accent gardent leur **rôle**, jamais leur **valeur** : les teintes
300/400 sont calibrées pour l'anthracite et disparaissent sur blanc.

| Utilitaire | Rôle | Clair |
|---|---|---|
| `text-emerald-400` | libellé nominal | `#047857` |
| `text-amber-400` | libellé de dérive | `#b45309` |
| `text-red-400` | libellé d'alarme | `#b91c1c` |
| `bg-emerald-500` / `-amber-500` / `-red-500` | pastilles d'état | `#059669` / `#d97706` / `#dc2626` |
| `text-metric-temperature` | température, refroidissement | `#2563eb` |
| `text-teal-300` | humidité | `#0d9488` |
| `text-violet-300` | densité | `#7c3aed` |
| `text-accent-300` / `-400` | accent, réservé à l'interaction | `#0369a1` / `#0284c7` |

`--color-accent-500` (`#0ea5e9`) est le seul à ne pas bouger : il n'est utilisé qu'en
voile (`bg-accent-500/15`, `border-accent-500/50`), qui tient sur les deux fonds. Les
pastilles d'état gardent leurs voiles à 10 % et leurs anneaux à 30 % dans les deux
thèmes : sur blanc l'aplat reste très pâle mais c'est l'anneau et le libellé sombre
qui portent l'état, et c'est plus discret que de doubler les classes.

### Les graphes ne lisent pas les variables CSS

Recharts reçoit `stroke` et `fill` en **valeur brute**, jamais en classe : la
redéfinition des variables ne l'atteint pas. Les couleurs des graphes sont donc
déclarées deux fois, dans `ChartPalette` (`src/lib/theme.ts`) : les trois teintes de
mesure, la bande nominale, la consigne, la grille, l'axe et les graduations.

`App` choisit la palette selon le thème et la passe à `FermentationDetail`, qui la
transmet aux `MetricChart`. La teinte de la courbe se déduit de `metric` : un seul
endroit décide de la couleur d'une mesure.

| Élément du graphe | Sombre | Clair |
|---|---|---|
| grille | `#1e2a38` | `#dbe3ee` |
| axe des abscisses | `#223040` | `#c8d3e6` |
| graduations | `#8b98a5` | `#64748b` |
| consigne (pointillés) | `#5f646c` | `#94a3b8` |
| bande nominale (aire à 14 %) | `#10b981` | `#059669` |

### Ce qui ne change pas avec le thème

Les **illustrations de contenant** (`TankVessel`, `KojiTray`, `MisoCrock`) gardent
leurs traits (`#3a3f47`, `#4a5058`) : c'est du dessin au trait, il se lit sur les deux
fonds. Leurs aplats (liquide, substrat, croûte, pâte) sont des **couleurs de produit**,
pas des couleurs de thème — une bière ambrée reste ambrée.

Le `--animate-bubble` et son doublage `motion-reduce:animate-none` sont eux aussi
indépendants du thème.
