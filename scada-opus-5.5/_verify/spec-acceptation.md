# Critères d'acceptation — adaptation mobile de `hakko-dashboard.html`

Compagnon de `spec-mobile.md`. Chaque critère dit **ce qu'on mesure**, **à quelle taille
d'écran** et **le seuil**. Un critère sans seuil n'en est pas un. Un seul critère en échec
suffit à refuser le correctif.

## Conditions de mesure (communes)

- **Données** : profil de navigateur vierge (`localStorage` vide), donc données de
  démonstration (`seed()`), mesures sur la page servie en `file://` (aucune requête au
  pont). Une seconde passe sur le cluster (`http://192.168.1.51:30090/hakko-dashboard.html`)
  se fait **avec** le jeton déjà enregistré.
- **Temps et hasard figés** pour les comparaisons avant/après : avant le chargement,
  injecter `Date.now = () => 1790150400000` (23/09/2026, 10 h 00) et remplacer
  `Math.random` par une suite déterministe. La simulation (`tick`) et l'horloge
  (`refreshLive`) produisent sinon des écarts qui ne viennent pas du correctif.
- **Barres de défilement masquées** (`--hide-scrollbars`), comme dans `verifie-mobile.mjs`.
- **Marges de sécurité** : `env(safe-area-inset-*)` vaut 0 en émulation. Ce qui en dépend
  se vérifie sur l'iPhone (section E).
- **« Zone tactile » d'un élément** : l'union de sa boîte (`getBoundingClientRect`) et
  de la boîte de son `::before` quand celui-ci est `position:absolute` (même calcul que
  `verifie-mobile.mjs`, l. 313-333).
- **Tolérances** : ±0,5 px pour une taille, ±1 px pour une position, sauf mention.

**Gabarits**

| Code | Taille | Classe attendue sur `<html>` | Rôle |
|---|---|---|---|
| É1 | 430 × 932 | `tactile` | iPhone 15 Pro Max portrait, **référence** |
| É2 | 430 × 600 | `tactile` | même largeur, petite hauteur (clavier, barre d'adresse) |
| É3 | 390 × 844 | `tactile` | iPhone 15 |
| É4 | 360 × 740 | `tactile` | Android étroit |
| É5 | 852 × 393 | `tactile` | téléphone en paysage ≤ 900 px (iPhone 15 Pro) |
| F1 | 1440 × 900 | `vue-tel` et `tactile` | vue forcée |
| F2 | 1440 × 700 | `vue-tel` et `tactile` | vue forcée, autre hauteur |
| B1 | 1280 × 720 | aucune | bureau |
| B2 | 1440 × 900 | aucune | bureau |
| B3 | 1600 × 900 | aucune | bureau |

**Pages** : P1 `#/` · P2 `#/appareils` (filtre Tous) · P3 `#/appareils` (filtre Prises)
· P4 `#/f/b1` (onglets Température **et** Densité) · P5 `#/f/b3` · P6 `#/recettes` ·
P7 `#/recettes/r1` · P8 `#/archive` · P9 `#/archive/b0`.

---

## A. Vrai par largeur (≤ 900 px, gabarits É1 à É5, sans vue forcée)

1. **Débordement du document.** Sur P1 à P9 : `documentElement.scrollWidth − clientWidth`
   = **0** et `body.scrollWidth − body.clientWidth` = **0**.
2. **Éléments hors cadre.** Sur P1 à P9, aucun élément visible ne sort de
   `[0, innerWidth]`, selon la définition de `verifie-mobile.mjs` (fixes, sous défilement
   latéral et découpés écartés) : **0** élément.
3. **Débordement masqué** (le défaut que les critères 1 et 2 ne voient pas). Sur P1 à P9,
   pour chaque `.card`, `.scroll-card`, `.lots` et `.home-grid > *` :
   `scrollWidth − clientWidth` ≤ **1 px**. Seules exceptions permises : `.tabs`, et
   `.tbl-wrap` et `.grav-list` à É4, qui peuvent défiler latéralement dans leur boîte.
4. **Onglets de filtre.**
   - À É1, sur P2 : `.tabs` a `scrollWidth − clientWidth` ≤ **1 px**, les 4 onglets
     (« Tous », « Température », « Humidité », « Prises ») ont chacun leur boîte
     entièrement dans celle de `.tabs`, et chaque onglet mesure au moins **44 px** de
     haut.
   - À É3 et É4 : la boîte de `.tabs` reste dans celle de sa carte (±1 px), `.tabs` a un
     `overflow-x` calculé à `auto`, et l'onglet actif a un `border-bottom-color` égal à
     la valeur calculée de `--accent`.
5. **Barre d'onglets basse.** Sur P1 à P9 : `#tabbar` a un `display` calculé à `flex`,
   **4** liens visibles dont les libellés sont, dans l'ordre, « Accueil, Archive,
   Recettes, Appareils ». Hauteur **64 ± 1 px**, bord bas = `innerHeight` (±0,5).
   Chaque lien mesure au moins **44 × 44 px**, et le lien de la rubrique courante a la
   couleur calculée de `--accent`.
6. **Colonne latérale.** Sur P1 à P9 : `.side` a un `display` calculé à `none`.
7. **Vue d'ensemble à une colonne.** Sur P1 :
   - `grid-template-columns` calculé de `.home-grid` = **une seule piste**, de largeur
     égale à la largeur intérieure de `.content` : 398 px à É1, 358 à É3, 328 à É4, 820
     à É5 (±1) ;
   - le haut de `.side-stack` est au moins au bas de la carte « Lots en cours » ;
   - chaque `.lot` a son bord droit ≤ au bord droit intérieur de `.lots` ;
   - à É1, largeur de chaque `.lot` ≥ **370 px** (84 px avant correctif).
8. **Interrupteur.** Sur P2, pour chaque `.switch` visible :
   - boîte **56 × 32 px** ; `::before` en `position:absolute` ; zone tactile
     **56 × 44 px**, donc au moins 44 × 44 ;
   - `::after` de **28 × 28 px** ;
   - `transform` calculé de `::after` = `matrix(1, 0, 0, 1, 24, 0)` si
     `aria-checked="true"`, `none` sinon.
9. **Écart entre commande et suppression.** Sur P2, pour chaque ligne de prise : entre le
   bord droit de la zone tactile de `.switch` et le bord gauche de la zone tactile du
   `[data-action="rm-dev"]` voisin, au moins **8 px** (valeur attendue : 11).
10. **Cibles tactiles.** Sur P1 à P9, après défilement de toute la page, chaque élément
    visible parmi `a[href]`, `button`, `select`, `input:not([type=radio]):not([type=hidden])`,
    `textarea` et `[role=tab]` a une zone tactile d'au moins **44 × 44 px** (pour
    `textarea` : hauteur ≥ 44). Nombre d'exceptions : **0**, hors liste fermée :
    `.kv dd a` (lien « Recette », exempté) et les éléments d'une `<dialog>` fermée.
    Relevé de contrôle, avant correctif, à É1 : **6** sur P1 et **31** sur P2.
11. **Champs sans zoom.** Sur P2, P3, P4, P7 et dans la boîte « Ajouter un appareil » :
    pour tout `input` (hors radio), `select` et `textarea` visible, `font-size` calculé
    ≥ **16 px**. La consigne (`.stepper input`) reste à **18 px**.
12. **Journal du lot.** À É1, sur P4 : chaque `#journal-list li.jl .jt` mesure au moins
    **250 px** de large (80 avant correctif), et son bord droit coïncide avec le bord
    droit intérieur du `li` (±1).
13. **Indépendance de la hauteur.** Même largeur, deux hauteurs (É1 et É2) : sur P1, P4
    et P9, la hauteur de `.dp` est identique (±1), `display` calculé de `.dp` ≠ `flex`,
    `.dp-chart` fait **380 px** et `.dp-journal` **420 px** (sur P9, `.arch-2` fait
    **320 px**).
14. **Classes et bouton.** À É1 à É5, sans vue forcée : `<html>` porte `tactile` et **ne
    porte pas** `vue-tel` ; `#vueBtn` a un `display` calculé à `none`.
15. **Formulaire de recette intact.** À É1, sur P7 : les lignes `.rrow.step` ont les
    pistes `24px <x>px 34px` (numéro dans la colonne de 24 px), et les lignes `.rrow`
    d'ingrédients `<x>px 96px 34px`.

## B. Vrai en vue forcée (F1 et F2, et à défaut de mention, sur P1 à P9)

La vue forcée est testée **deux fois** : en cliquant `#vueBtn` (chemin réel), et en ne
posant que `vue-tel` par script (chemin du banc existant). Les critères 16 à 24 doivent
passer dans les deux cas.

16. **Classes.** Après le clic : `<html>` porte `vue-tel` **et** `tactile`, et
    `#vueBtn` a `aria-pressed="true"`.
17. **Cadre.** Largeur de `body` = **430 px**, bord gauche à **505 px** (±1) à 1440 px ;
    `#tabbar` a son bord gauche à 505 px (±1), une largeur de 430 px et son bord bas à
    `innerHeight`.
18. **Équivalence avec le téléphone.** Pour chaque page P1 à P9 et chaque sélecteur de la
    liste ci-dessous, largeur et hauteur mesurées en F1 = mesure en É1 (±1 px), et
    position horizontale relative (`x − body.left`) égale (±1 px) :
    `.content`, `.home-grid > *`, `.kpis .kpi`, `.lot`, `.tabs`, `.tabs > button`,
    `.switch`, `.outlet`, `.dp-chart`, `.dp-journal`, `.dp-side`,
    `#journal-list li.jl .jt`, `.rrow`, `.grav-side .grav-form`, `#tabbar a`.
19. **Invariants mobiles.** En F1, les critères 1, 2, 3, 5, 6, 7 (colonne de 398 px), 8,
    9, 10, 11 et 12 passent avec les mêmes seuils qu'à É1.
20. **Verrou de hauteur neutralisé.** En F1 et F2 : `display` calculé de `.dp` ≠ `flex`,
    et hauteur de `.dp` identique entre F1 et F2 (±1) sur P1, P4 et P9. Sur P4 et P9 :
    `padding-top` de `.content` = **20 px** et `padding-bottom` = **84 px**.
21. **Bouton enfoncé.** Bouton visible (34 × 34 px visibles, zone tactile ≥ 44 × 44) ; son
    fond calculé est égal à la valeur calculée de `--accent-soft`.
22. **Aller-retour sans résidu.** Sur P1 à P9 : cliquer `#vueBtn` deux fois fait revenir à
    l'état B2. Écart géométrique **nul** au sens du critère 29, entre avant le premier
    clic et après le second. Dans les 500 ms qui suivent chaque bascule, la largeur du
    `svg` de chaque `[data-chart]` = largeur intérieure de son conteneur (±1) :
    graphiques redessinés.
23. **Persistance et première image.** Avec `localStorage['hakko-vue'] = 'tel'`, au
    rechargement, la classe `vue-tel` est déjà présente dans le premier
    `requestAnimationFrame` (script injecté avant le chargement). Après une sortie de la
    vue forcée, la clé `hakko-vue` est **absente**.
24. **Logique des prises unique.** Pendant 10 bascules consécutives de la vue : **0**
    requête vers `api/prise`, **0** navigation (une seule entrée
    `performance.getEntriesByType('navigation')`), et la valeur de `regulId` est
    identique avant et après : même instance de la page, même régulateur.

## C. Console (tous gabarits, toutes pages, vue forcée comprise)

25. **Zéro erreur.** Nombre d'`pageerror` = **0**, de messages `console.error` = **0** et
    de requêtes échouées = **0**. Liste fermée des exclusions : requêtes vers
    `fonts.googleapis.com` et `fonts.gstatic.com` (police externe, voir
    `spec-mobile.md` §10, point 10) et `/favicon.ico` en 404. En passe cluster, jeton
    enregistré : **0** réponse 401 ou 403 sur `api/etat`.

## D. Invariance du bureau (B1, B2, B3, sans classe)

26. **Aucune classe.** `<html>` ne porte ni `vue-tel` ni `tactile`. `#vueBtn` est visible,
    mesure **34 × 34 px** et a `aria-pressed="false"`.
27. **Interrupteur de souris.** Sur P2 : `.switch` de **36 × 20 px**, `content` calculé
    de son `::before` = `none`, `::after` de **16 × 16 px**.
28. **Champs et boutons de bureau.** Sur P2 et P7 : `font-size` des champs = **14 px**
    (13 px pour `table.data select` et `.o-f select`), hauteur de `.btn` = **36 px**,
    de `.btn.sm` = **30 px**, de `.seg button` = **30 px**. Pistes de `.home-grid` sur
    P1 : `<x>px 300px` à B1, `<x>px 340px` à B2 et B3 (la règle `≤ 1360 px` reste
    intacte).
29. **Écart géométrique nul.** Temps et hasard figés, sur P1 à P9, comparaison du fichier
    avant et après correctif. Pour **chaque** élément de `body`, sauf `#vueBtn` et
    `.top-right` : boîte (x, y, largeur, hauteur, arrondies au ½ px) identique, ainsi que
    les valeurs calculées de `display`, `position`, `grid-template-columns`, `height`,
    `padding`, `margin`, `font-size`, `overflow-x` et `box-shadow`. Écarts admis, et
    seulement ceux-là : `.top-right` garde son bord droit (±0,5) et s'élargit de
    **48 px** (±0,5) ; `#themeBtn` garde exactement sa boîte.
30. **Pixels identiques.** Mêmes conditions : captures pleine page avant et après, avec le
    rectangle de `.top-right` masqué (union des rectangles avant et après). **0** pixel
    différent sur P1 à P9, à B1, B2 et B3.

## E. Sur l'iPhone 15 Pro Max réel (Safari, réseau local, relevé manuel)

31. **Pas de zoom au focus.** Toucher successivement les sélecteurs « Fermentation » et
    « Mode » (P2), la consigne (P4) et le champ de note (P4) : `visualViewport.scale`
    reste à **1** (lu dans la console web de Safari sur Mac, ou affiché par un
    marque-page de test).
32. **Zone de l'interrupteur.** Toucher à 4 px au-dessus puis à 4 px au-dessous du bord
    visible d'un interrupteur bascule la prise. Toucher au milieu de l'écart
    interrupteur–× ne déclenche **ni** l'un **ni** l'autre. Sur 10 essais : 10 résultats
    conformes.
33. **Barre basse et indicateur d'accueil.** Portrait, barre d'outils de Safari réduite :
    le bas des libellés de `#tabbar` reste au-dessus de l'indicateur d'accueil, et la
    fin de page ne laisse **pas** de bande vide de plus de 20 px sous le dernier contenu
    (marge de sécurité comptée une seule fois).
34. **Paysage.** Téléphone tourné (932 px), vue forcée enfoncée : cadre de 430 px centré,
    aucun contenu sous l'îlot dynamique.

---

## Écarts avec le banc existant `verifie-mobile.mjs`

Le banc couvre une partie des critères. Pour servir de preuve, il lui manque :

| Critère | Banc actuel | À ajuster |
|---|---|---|
| 8 | exige 52 × 32 | exiger **56 × 32** (±0,5), la pastille et la translation |
| 3 | rien : le débordement découpé est écarté, et c'est précisément le défaut de la vue d'ensemble | ajouter le contrôle « débordement masqué » |
| 18 à 20 | la grille et l'interrupteur en vue forcée sont **imprimés** (`info`), pas vérifiés | en faire des assertions, et ajouter l'équivalence avec É1 |
| 10, 11, 12, 13, 15 | absents | à ajouter ; P4 à P9 ne sont jamais chargées |
| 29, 30 | seulement : barre basse masquée, colonne visible, interrupteur 36 × 20 | ajouter l'écart géométrique et les pixels, **et le gabarit 1600 × 900** |
| marqueur de version (contrôle 5) | exige `data-version` et `window.HAKKO_VERSION` | ni l'un ni l'autre n'existe dans le fichier : le banc échouera là, indépendamment du correctif |
| vue forcée | ne pose que `vue-tel` | compatible avec la spécification (règles tactiles sous `html:is(.tactile,.vue-tel)`) ; ajouter le chemin par clic (critère 16) |
