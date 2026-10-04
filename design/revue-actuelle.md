# Revue — Web Interface Guidelines (Vercel) appliquées à `hakko-dashboard.html`

Règles récupérées le 2026-09-28 depuis
`https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`.
Fichier lu en entier (1 952 lignes), jamais écrit (sha256 `e3e6586d…bf9`, identique avant et après).
Contrastes calculés avec la formule WCAG 2.x sur les jetons du fichier (script Python), pas à l'œil.

## scada-opus-5.5/hakko-dashboard.html

### Les trois défauts signalés

scada-opus-5.5/hakko-dashboard.html:252 - CORRIGÉ : `outline:none` bien présent, mais un remplacement existe l. 254 (`input:focus` → bordure accent + halo `--accent-soft`). Il est trop faible : halo `#EAF0FC` sur `#FFF` = 1,14:1 (sombre : 1,17:1) ; seul le changement de bordure de 1 px se voit
scada-opus-5.5/hakko-dashboard.html:76 - CORRIGÉ : ce `:focus-visible` global vise TOUS les éléments, champs compris ; il perd parce que `input[type=text]` (0,1,1) l. 252 bat `:focus-visible` (0,1,0)
scada-opus-5.5/hakko-dashboard.html:357 - CONFIRMÉ avec la même nuance : `input:focus` l. 254 couvre aussi `datetime-local`, remplacement faible (1,14:1)
scada-opus-5.5/hakko-dashboard.html:353 - NOUVEAU, le vrai trou : champ de consigne `.stepper input` = `border:0` (l. 351) + `outline:none` (l. 252) + `box-shadow:none` → aucun indicateur de focus, sur le champ qui pilote la chauffe
scada-opus-5.5/hakko-dashboard.html:182 - CONFIRMÉ : aucun `prefers-reduced-motion` dans le fichier ; transitions l. 182, 228, 229, 473, 484
scada-opus-5.5/hakko-dashboard.html:4 - CONFIRMÉ : pas de `<meta name="theme-color">` (attendu : deux balises `media="(prefers-color-scheme: …)"` + mise à jour dans `applyTheme()` l. 1931)

### Accessibilité

scada-opus-5.5/hakko-dashboard.html:1532 - `<tr class="click" data-href>` : ligne cliquable à la souris seulement, ni focus clavier ni lien (idem l. 1595, 1725 ; gestionnaire l. 1830) → `<a>` dans la première cellule
scada-opus-5.5/hakko-dashboard.html:647 - pas de lien d'évitement vers `<main id="view">`
scada-opus-5.5/hakko-dashboard.html:650 - deux `<nav>` (l. 650, 669) sans `aria-label` pour les distinguer
scada-opus-5.5/hakko-dashboard.html:1029 - `svgI()` : icônes décoratives sans `aria-hidden="true"` (idem `IC` l. 720-728, `MARK` l. 1052, marque l. 649)
scada-opus-5.5/hakko-dashboard.html:1132 - `refreshLive()` réécrit valeurs, badges et fil d'activité toutes les 3 s sans aucune région `aria-live` (au minimum : KPI « Écarts », `#feed`, statut de synchro)
scada-opus-5.5/hakko-dashboard.html:1134 - badge d'état remplacé par `outerHTML` à chaque tic : nœud détruit, toute future annonce ou focus perdu
scada-opus-5.5/hakko-dashboard.html:1448 - `role="tablist"`/`role="tab"` sans `tabpanel`, `aria-controls` ni flèches clavier (idem l. 1541, 1643) → implémenter le motif ou passer à `aria-pressed`
scada-opus-5.5/hakko-dashboard.html:1476 - `aria-label` sur un `<div>` sans rôle : ignoré → `role="progressbar"` + `aria-valuenow`
scada-opus-5.5/hakko-dashboard.html:1632 - `aria-label="Prise N : allumer ou éteindre"` masque le texte visible « ON »/« OFF » (WCAG 2.5.3, libellé dans le nom)
scada-opus-5.5/hakko-dashboard.html:1612 - `aria-label="Mode"` : 5 sélecteurs au même nom → « Mode de Multiprise Tim Outlet 1 »
scada-opus-5.5/hakko-dashboard.html:1630 - sélecteurs de la multiprise : nom seulement via `<span>` « Fermentation »/« Mode », identique pour les 5 prises
scada-opus-5.5/hakko-dashboard.html:670 - `<dialog>` sans nom accessible (`aria-labelledby` vers son `<h2>`)
scada-opus-5.5/hakko-dashboard.html:936 - graphique : survol au pointeur seulement (l. 956-957), aucune alternative clavier ni résumé textuel des valeurs
scada-opus-5.5/hakko-dashboard.html:1449 - groupe `.seg` sans `role="group"` ni `aria-label` (« Période »)
scada-opus-5.5/hakko-dashboard.html:1517 - `<time>` sans attribut `datetime` (idem l. 300)
scada-opus-5.5/hakko-dashboard.html:663 - bouton de thème : `aria-label` fixe, l'état courant n'est que dans `title` (l. 1934)

### Contrastes (mesurés)

scada-opus-5.5/hakko-dashboard.html:37 - `--faint #9CA3AF` sur `#FFF` = 2,54:1 (sur `--surface2` 2,39:1) ; sert à du texte : horodatages l. 202, 300, unités l. 260, « facultatif » l. 257
scada-opus-5.5/hakko-dashboard.html:53 - sombre : `--faint #6B7380` sur `#161A21` = 3,65:1
scada-opus-5.5/hakko-dashboard.html:364 - `--muted` sur `--bg` = 4,43:1 (`.dp-sub`, `.ph p` l. 129 posés sur le fond de page)
scada-opus-5.5/hakko-dashboard.html:149 - `.badge.ok` `#15803D` sur `#E7F6EC` = 4,49:1, sous le seuil, en 12 px
scada-opus-5.5/hakko-dashboard.html:89 - `.nav-sec` `#6F7885` sur `#151A21` = 3,91:1 en 12 px (idem `.nav .cnt` l. 95)
scada-opus-5.5/hakko-dashboard.html:252 - bordure de champ `--line2` sur `#FFF` = 1,47:1 (composant d'interface < 3:1)
scada-opus-5.5/hakko-dashboard.html:228 - interrupteur éteint `--line2` sur `#FFF` = 1,47:1 : l'état « off » se confond avec le fond
scada-opus-5.5/hakko-dashboard.html:487 - « ON » blanc sur `#1F9D55` = 3,49:1 en 15 px gras (pas « grand texte ») ; couleurs en dur, hors jetons, ignorées par le thème sombre
scada-opus-5.5/hakko-dashboard.html:484 - « OFF » en rouge `#C53030` : rouge = alerte partout ailleurs (`--bad`), ici rouge = repos normal

### Focus & défilement

scada-opus-5.5/hakko-dashboard.html:72 - `scroll-padding-top` ne compte que l'encoche : la barre collante de 60 px (l. 100) et la barre d'onglets fixe (l. 120) peuvent couvrir l'élément focalisé → ajouter 60 px en haut, `scroll-padding-bottom` en mobile

### Formulaires

scada-opus-5.5/hakko-dashboard.html:1869 - commande de prise vers le pont : aucun état « en cours », bouton actif pendant la requête → double envoi possible, rien à l'écran
scada-opus-5.5/hakko-dashboard.html:1889 - densité hors bornes : `return` silencieux, aucune erreur affichée (idem consigne l. 1895)
scada-opus-5.5/hakko-dashboard.html:1912 - erreurs de recette regroupées en bas (`#ferr` l. 1588), pas à côté du champ ; focus posé seulement pour le nom (l. 1910), pas pour durée/température (l. 1912-1913)
scada-opus-5.5/hakko-dashboard.html:1563 - formulaire de recette : aucun avertissement de modifications non enregistrées
scada-opus-5.5/hakko-dashboard.html:1462 - placeholders sans `…` : l. 1462, 1543, 1551, 1552, 1569, 1570, 1653, 1737
scada-opus-5.5/hakko-dashboard.html:1491 - placeholder `1.007` avec un point alors que l'interface affiche `1,007` ; pas d'`inputmode="decimal"`
scada-opus-5.5/hakko-dashboard.html:1462 - `autocomplete="off"` absent des champs non liés à l'identité (l. 1462, 1543, 1569, 1653, 1737) ; `name="x"` peu parlant
scada-opus-5.5/hakko-dashboard.html:1658 - focus automatique du premier champ à l'ouverture du dialogue : ouvre le clavier sur téléphone
scada-opus-5.5/hakko-dashboard.html:1880 - recherche : `render()` de toute la vue à chaque frappe puis re-focus (idem l. 1881)

### Mouvement

scada-opus-5.5/hakko-dashboard.html:182 - transition sur `border-color`/`box-shadow` (pas `transform`/`opacity`)
scada-opus-5.5/hakko-dashboard.html:228 - transition sur `background` (idem l. 473 `border-color`, l. 484 `background`)

### Typographie & contenu

scada-opus-5.5/hakko-dashboard.html:1110 - nombre et unité séparés par une espace sécable (`' °C'`, `' %'`, `' W'`) : « 21,3 » et « °C » peuvent se séparer → U+202F (idem l. 1121, 1372, 1472, 1511…)
scada-opus-5.5/hakko-dashboard.html:78 - titres sans `text-wrap: balance`
scada-opus-5.5/hakko-dashboard.html:1252 - apostrophes droites dans des textes affichés (« n'a », « d'état », l. 1238, 1252) ; le reste du fichier utilise `’`
scada-opus-5.5/hakko-dashboard.html:201 - `.feed .ft` sans `overflow-wrap:anywhere` : `switch.shellyazplug_e4b3232e116c` (l. 1068) peut déborder à 390 px
scada-opus-5.5/hakko-dashboard.html:185 - `.lot-n`, `.dp-title h1` (l. 363) : aucun traitement des noms de lot longs
scada-opus-5.5/hakko-dashboard.html:1251 - erreurs du pont sans étape suivante (l. 1238, 1251, 1298) : dire quoi faire (vérifier le pod du pont, réessayer)
scada-opus-5.5/hakko-dashboard.html:1384 - « W consommés » : la multiprise Meross MSS425f ne mesure pas la puissance (commit 0426676) ; pont actif → `d.power` indéfini → « — W consommés ». Présenter comme donnée absente, pas comme mesure
scada-opus-5.5/hakko-dashboard.html:1615 - identifiants `sensor.*`/`switch.*` et marque « Hakko » sans `translate="no"`

### Survol & états

scada-opus-5.5/hakko-dashboard.html:162 - `.seg button` sans `:hover` (idem `.types span` l. 316, `.switch` l. 228)
scada-opus-5.5/hakko-dashboard.html:136 - `.btn.primary:hover` éclaircit le fond : le contraste du texte blanc baisse au survol

### Toucher

scada-opus-5.5/hakko-dashboard.html:73 - pas de `touch-action: manipulation` ni de `-webkit-tap-highlight-color` choisi
scada-opus-5.5/hakko-dashboard.html:334 - `<dialog>` sans `overscroll-behavior: contain` (idem listes `.scroll` l. 390)

### Navigation & état

scada-opus-5.5/hakko-dashboard.html:1310 - filtres, onglets et période (`recipeTab`, `recipeType`, `recipeQuery`, `devFilter`, `detailRange`, `detailChart`, `journalFilter` l. 1498, `archType` l. 1663) hors de l'URL : retour arrière ou rechargement les perd
scada-opus-5.5/hakko-dashboard.html:1848 - suppression d'un relevé de densité immédiate, sans confirmation ni annulation

### Locale

scada-opus-5.5/hakko-dashboard.html:692 - `fmt()` = `toFixed()` + remplacement du point ; `Intl.NumberFormat('fr-FR')` fait la même chose
scada-opus-5.5/hakko-dashboard.html:703 - `ago()` en dur ; `Intl.RelativeTimeFormat('fr')`

### Performance

scada-opus-5.5/hakko-dashboard.html:1348 - `resize` redessine tous les graphiques sans `requestAnimationFrame`, en plus du `ResizeObserver` l. 952 : double travail
scada-opus-5.5/hakko-dashboard.html:1340 - `drawChart` lit `clientWidth` (l. 900) juste après `innerHTML` : lecture de mise en page forcée, entrelacée graphique par graphique

### Conformes

✓ `lang="fr"` · zoom non bloqué (l. 5) · `color-scheme` par thème · `preconnect` + `display=swap` · `tabular-nums` (`.num`) · `env(safe-area-inset-*)` · cibles 44 px en tactile (l. 584-616) · aucun `transition: all` · aucun `onPaste` · aucune `<img>` · confirmation sur « Terminer », « Supprimer », « Retirer ».

Non appliqué volontairement : « Title Case (Chicago) » ne vaut pas pour le français, où la casse de phrase est la norme — l'existant a raison.
