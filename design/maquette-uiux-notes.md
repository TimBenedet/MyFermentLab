# Variante « ui-ux-pro-max » — notes

Fichier : `design/maquette-uiux.html` (1 456 lignes, autonome, HTML, CSS et JS natifs ; seule
ressource externe : Google Fonts). C'est une **copie re-habillée** de
`design/maquette-hakko.html` : mêmes routes, mêmes données, mêmes calculs (`statut`,
`progression`, hystérésis, `modele`, `stats`), mêmes formulaires et mêmes intitulés.

Je n'ai touché à aucun autre fichier : ni la première maquette, ni le dashboard de
production (sha256 inchangé, `e3e6586d…bf9`), ni les notes, ni la revue.

## 0. Ce que j'ai vu, et ce que je n'ai pas vu

**Captures lues.** Les cinq captures de `design/captures/` s'ouvrent cette fois. Elles
montrent la **première maquette** et la **production**, pas cette variante. Ce que j'y
constate, sans rien extrapoler :

| Capture | Constat |
|---|---|
| `maquette-bureau.png` (1440 × 900) | 2 lots entiers (Miso, Garum). La seconde rangée (Saison, Koji) est coupée au niveau du chiffre. Mon estimation de la critique (2 sur 4) est confirmée. |
| `actuel-bureau.png` | 4 lots sur 4 entiers, sans défilement. Confirmé. |
| `actuel-telephone.png` (430 × 932) | 1 lot entier (Miso), le second coupé. Confirmé. |
| `maquette-telephone.png`, `maquette-390.png` | Pages **déjà défilées** : elles montrent Saison et Koji (et le Garum à 390 px) avec la barre d'onglets. Elles ne permettent pas de vérifier ce qui est visible *sans* défiler. |
| `maquette-telephone.png`, `maquette-390.png` | Aucun débordement horizontal visible. Le fil d'Ariane de la barre du haut **n'apparaît pas** (seuls la marque, l'heure et le bouton de thème). Je n'en connais pas la cause. |
| Plusieurs captures | Une carte porte un anneau de focus (Saison), probablement laissé par la navigation qui a précédé la capture. |
| `actuel-*` | La production affiche d'autres valeurs que celles du brief (Miso 23,1 °C, Saison 22,1 °C, humidité 64 %) : ce sont les valeurs vivantes du moment. |

**Cette variante n'a jamais été vue.** L'exécution de `chromium` m'a de nouveau été
refusée : aucun rendu, aucune capture, aucune exécution de son JavaScript. Tout ce qui suit
sur sa mise en page est **calculé**, pas observé.

## 1. Ce que la base impose sans ambiguïté, et comment c'est appliqué

| Prescription (source : `ui-ux-pro-max-systeme.md` et brief) | Application |
|---|---|
| Style « Dark Mode (OLED) », clair « *not-recommended* » | **Sombre uniquement.** Le bouton de thème est supprimé, `color-scheme: dark`, un seul `theme-color` `#0F172A`. |
| Couleurs de la base | Les 16 jetons sont repris **avec leurs noms** (`--color-primary`, `--color-ring`…) et leurs valeurs exactes. |
| Typographie Fira Code + Fira Sans | Chargée avec l'URL exacte de la base (400 à 700 et 300 à 700, `display=swap`). Repli système complet, sans Inter, Roboto ni Arial. Fira Code pour **les titres et les données**, Fira Sans pour le texte et les **libellés** (« *Sans for labels* »). |
| `data-dense-dashboard` : grille de 12 colonnes, `gap:8px`, `padding:12px` | Classe `.grille` en `repeat(12,…)` et placement `s3`, `s4`, `s8`, `s12`. Variables `--grid-gap`, `--card-padding`, `--table-row-height`, `--sidebar-width` (240) et `--header-height` (56) reprises telles quelles. |
| Échelle 12 · 14 · 16 · 18 · 24 · 32 | **Six jetons `--t12`… `--t32`, aucune autre taille** (vérifié par script : la seule valeur écrite en dur est 12 px, sur le texte des graphiques). **Aucune taille de lecture hors échelle** : la base n'en exige nulle part, la plus grande valeur est 32 px (indicateurs). La première maquette avait 21 tailles. |
| Tableaux : `overflow:auto`, en-têtes collants, lignes de 36 px | `.defile` en `overflow:auto` avec hauteur bornée ; `th` en `position:sticky` ; `td` à `height:36px` ; `scroll-padding-top` égal à la hauteur d'en-tête, pour que le focus clavier ne passe pas sous l'en-tête collant. |
| « *Row highlighting on hover* », « *Hover tooltips* » | Survol des lignes, bulle sur la courbe. |
| « *periodic-refresh line chart* » | Ligne **sans aire remplie** ; consigne en pointillés, plage tolérée en bande, **marqueurs** (1 par heure ou par jour) en plus de la couleur. |
| A11y fallback : « *data table plus current-value/trend summary* » | Résumé textuel (minimum, maximum, dernière valeur, **tendance**) et `<details>` « Tableau des données » **agrégé** : par heure jusqu'à 2 jours, par jour jusqu'à 31 jours, par semaine au-delà (24, 7 ou environ 21 lignes, jamais 161). |
| « *Pause/Resume, +/- zoom, Reset* » | Bouton Pause/Reprendre (barre du haut et barre d'outils de la courbe) ; zoom −, + et Rétablir (×1 à ×16, ancré sur la fin) ; touches `+` et `−` sur la courbe focalisée ; flèches pour lire chaque point. |
| Pattern Real-Time : « *live only when backed by a current source, with update time and stale state* » | « En direct » n'apparaît **jamais** : la maquette n'a pas de source. Le statut dit « Démonstration · aucune source · actualisé HH:MM:SS » (« Démo » sur téléphone), « En pause depuis… » en pause. **Chaque mesure porte son âge** ; au-delà de 15 min, elle est **périmée** (voir 2.3). |
| « *Stop offscreen/hidden work* » | `visibilitychange` : le minuteur s'arrête quand l'onglet est masqué, puis rafraîchissement **immédiat** et reprise au retour. La pause arrête aussi le minuteur. |
| « *Render a static final snapshot under reduced motion* » | Sous `prefers-reduced-motion: reduce`, la classe `js-rev` n'est jamais posée et les transitions de survol n'existent pas : état final immédiat. |
| Mouvement « *Scroll Reveal (Subtle)* » : opacité 0, y 12, 350 ms, power1.out, `play none none reverse` | Sans GSAP, qui serait une bibliothèque : `IntersectionObserver` avec une marge de −10 % (≈ `start: 'top 90%'`), transition CSS 350 ms sur `opacity` et `transform`, courbe `cubic-bezier(.25,.46,.45,.94)` (≈ power1.out). « reverse » : la carte se masque à nouveau quand on remonte au-dessus du déclencheur. |
| Checklist : « *cursor-pointer on all clickable elements* », « *Hover… 150-300ms* », « *No emojis as icons* », focus visible | `cursor:pointer` sur tout ce qui est cliquable ; transitions de survol de 150 ms sur `background-color`, `border-color` et `color` ; icônes SVG, aucun emoji ; anneau `--color-ring` sur tout élément interactif. |
| « *Minimal glow (text-shadow: 0 0 10px)* » | Sur la valeur courante de température seulement, dans la couleur de son état ; retiré quand la mesure est périmée. |
| Pattern : « *CTA in nav + After metrics* » | « Lancer une fermentation » dans la barre latérale, dans la barre du haut (icône seule sur téléphone, avec `aria-label`) et après les indicateurs, en tête de « Lots en cours ». |
| Règle UX Breadcrumbs : « *Don't pour un site plat* » | Plus de fil d'Ariane. Au 2e niveau, un seul lien « ‹ Recettes » ou « ‹ Vue d'ensemble » ; au 1er niveau, rien (le repère est masqué). |

## 2. Ce que j'ai dû interpréter

1. **L'ambre de maintenance.** La base le nomme (« *maintenance amber* ») sans le chiffrer.
   J'ai pris `#F59E0B`, de la même famille que le reste de la palette (slate, green et red
   sont des teintes Tailwind). Il sert à « écart léger », « chauffe active », « échu » et
   « mesure périmée » dans le compteur.
2. **Le seuil de péremption : 15 minutes.** La base exige un état périmé sans fixer de
   seuil. Je ne connais toujours pas l'intervalle réel de remontée des sondes Sonoff dans
   Home Assistant : 15 min est une valeur par défaut, **à mesurer avant tout usage réel**.
3. **Montrer un état périmé.** Les données réelles n'en contiennent pas. J'ai déclaré la
   sonde d'humidité `sensor.humidity_1` « arrêtée » depuis 42 min (`arrete:true`). Sa valeur
   (56,9 %) ne change pas ; seul son âge est inventé. Aucun compteur ne bouge : les
   écarts de température restent à 3, et la péremption apparaît en ambre (« 1 mesure
   périmée ») sous « Appareils en ligne 9/9 ».
4. **Nouvelle règle métier dérivée de la base.** Une température périmée donne l'état
   « Mesure périmée », jamais « Dans la cible ». La régulation (`reguler()`) ne décide plus
   rien sur une mesure périmée. C'est un changement de comportement, justifié par le
   pattern ; il ne concerne aujourd'hui aucune donnée de température.
5. **Sections du pattern « Operations Landing ».** C'est un pattern de **page d'accueil
   commerciale** (« *Offer a demo… Start trial / Contact* ») appliqué à un tableau de bord
   privé. J'ai gardé ce qui a un sens :
   - **Hero :** le titre et le statut de la source.
   - **Key metrics :** les indicateurs.
   - **How it works :** un `<details>` « Comment fonctionne la régulation », avec les règles
     réelles de la production (hystérésis ±0,2 °C, une commande par minute, coupure après
     45 min, pause de 15 min).
   - **CTA final :** « Lancer une fermentation ».

   J'ai laissé de côté « *Start trial / Contact* » et les « *trust signals* » : pour une
   personne seule chez elle, ils n'ont pas d'objet.
6. **Hauteur de ligne de 36 px.** Appliquée comme **minimum** (`height` sur une cellule de
   tableau). Les lignes d'appareils, qui affichent le nom et l'identifiant Home Assistant
   sur deux lignes, dépassent 36 px : tronquer l'identifiant aurait caché une information.
7. **« Dark-to-light transitions ».** Formule ambiguë ; je l'ai lue comme des survols qui
   éclaircissent la surface, en 150 ms.
8. **Réglette thermique.** C'était l'identité de la première maquette, et la base ne la
   prescrit pas. Elle est remplacée par ce que prescrit `data-dense-dashboard` : une carte
   indicateur compacte (trois cellules Température, Cible, Densité / Humidité / Chauffe)
   et une courbe périodique de 24 h.

## 3. Appliqué contre mon jugement

- **Le vert primaire face au vert d'état (§ 2.2 de ma critique).** Appliqué : boutons
  primaires, filtres actifs, interrupteurs et prises allumées sont en `#16A34A`, et
  **l'anneau de focus lui-même est vert** (`--color-ring`). Ma résolution, partielle :
  - **Deux verts distincts.** `--color-primary` `#16A34A`, **plein** avec texte noir, pour
    l'action et l'état « allumé ». `--color-secondary` `#22C55E`, en **texte ou contour**,
    jamais plein, pour « Dans la cible ».
  - **Des formes différentes.** L'état « ok » est un badge contouré avec un disque ; l'action
    est un bloc plein ; l'anneau est un contour décalé de 2 px.
  - **Ce qui reste ambigu :** un lot « Hors plage » qui reçoit le focus est entouré de vert.
    Le badge rouge et son losange disent le contraire, mais le premier coup d'œil peut se
    tromper. Je ne l'ai pas corrigé, puisque c'est la base.
- **Le rouge comme couleur d'appel.** « *Accent/CTA : #DC2626* » : le bouton principal
  « Lancer une fermentation » est **rouge**, comme les incidents (« *incident red* ») et les
  actions destructives. Le rouge signifie donc à la fois « agissez ici » et « quelque chose
  ne va pas ».
- **Sombre uniquement.** Il n'y a plus de mode clair, même en cuisine éclairée : c'est le
  cas que je défendais dans la critique.
- **Température à 24 px sur les cartes** (32 px au plus ailleurs). Lisible sur un bureau,
  plus difficile à un bras de distance.
- **Transitions de couleur au survol.** Elles contredisent la règle Vercel (« n'animer que
  `transform` et `opacity` »). Elles ne nuisent pas à l'accessibilité, je les ai donc
  appliquées.

**Écarts où l'accessibilité l'emporte** (les seuls, tous nommés « compl. » dans le CSS) :

| Jeton de la base | Problème mesuré | Complément |
|---|---|---|
| `#DC2626` en **texte** | 3,67:1 sur carte, sous 4,5 | `--incident-texte` `#F87171` (6,41:1) pour le texte. `#DC2626` reste en fond, avec du blanc à 4,83:1. |
| `--color-border` `#334155` comme **bordure de champ** | 1,71:1, sous 3 | `--bord-controle` `#64748B` (3,73:1 sur carte, 3,07:1 sur `muted`) pour champs, boutons et interrupteurs. `#334155` reste la bordure des cartes (décorative). |
| `--color-primary` en **texte sur `muted`** | 4,44:1 | Jamais employé ainsi : le texte vert est en `--color-secondary`. |

Rien d'autre n'a été retenu : cibles de 44 px, champs de 16 px, `env(safe-area-inset-*)` et
barre d'onglets basse restent ceux de la première maquette.

## 4. Mes dix actions de critique : ce que cette variante corrige

| # | Action | État dans la variante |
|---|---|---|
| 1 | Âge et état périmé, pas de « live » sans source | **Corrigée par construction** (§ 1, § 2.3) |
| 2 | Téléphone : la première température au-dessus de la ligne de flottaison | **Ouverte.** La base place « Key metrics » avant le contenu. Calcul à 390 × 844 : la première carte commence vers 627 px et finit vers 917 px, alors que la zone utile s'arrête vers 778 px. **0 lot entier**, comme la première maquette. |
| 3 | Bureau : 4 lots visibles à 1440 × 900 | **Corrigée, selon le calcul.** Les lots commencent vers 345 px, cartes d'environ 230 px sur 2 colonnes : fin de la seconde rangée vers 813 px, donc **4 lots sur 4** avec environ 85 px de marge. Non vérifié à l'écran. |
| 4 | Échelle typographique à 6 valeurs | **Corrigée** : 6 jetons, vérifié par script. |
| 5 | Libellés en Sans 12 px, casse normale | **Corrigée** : aucun `text-transform`, `letter-spacing:0`. |
| 6 | Courbe sans aire, tableau de données agrégé | **Corrigée.** |
| 7 | Rien quand l'onglet est masqué, rafraîchissement au retour | **Corrigée.** |
| 8 | Fil d'Ariane seulement au 2e niveau | **Corrigée**, sous forme de lien de retour. |
| 9 | Tableaux : lignes de 36 px, en-têtes collants | **Corrigée**, avec la nuance du § 2.6. |
| 10 | Marge de contraste du fond texturé | **Sans objet** : le fond est un aplat `#0F172A`. La marge la plus faible est désormais 3,07:1 (bordure de contrôle sur `muted`, seuil 3). |

## 5. Mesures faites

| Mesure | Outil | Résultat |
|---|---|---|
| Contraste de **toutes les paires de couleurs employées** (36), survols compris | Calcul WCAG en ligne (Python) | **0 échec.** Plus faible texte : 4,83:1 (blanc sur CTA rouge). Plus faible interface : 3,07:1 |
| Balises HTML, accolades CSS, structure du JS (chaînes, gabarits, regex) | `design/_mesures/verif_statique.py`, exécuté en lecture seule | Équilibrés ; aucun `id` manquant ; toutes les actions ont un gestionnaire |
| Tailles de police | Relevé par regex du CSS | Jetons 12, 14, 16, 18, 24, 32 et rien d'autre |
| `transition: all`, propriétés animées | idem | Aucun `all`. Révélation : `opacity` et `transform` 350 ms ; survols : couleurs 150 ms ; interrupteur : `transform` 150 ms |
| `outline:none` | idem | 2 : `<main>` (non interactif) et le lien étiré (anneau reporté sur la carte ou la ligne) |
| Identité « Thermographe » résiduelle (Plex, grain, grille, capitales espacées) | Recherche dans le fichier | Aucune |
| Fichier de production | `sha256sum` | Inchangé |

**Non vérifié :**
- le rendu dans son ensemble ;
- le chargement réel de Fira ;
- l'exécution du JavaScript (relu, jamais exécuté) ;
- l'absence de débordement à 390 px ;
- la zone réellement touchable ;
- le comportement de l'en-tête collant dans son conteneur défilant ;
- la révélation au défilement ;
- les chiffres de visibilité du § 4, qui sont des calculs.

**Pour une comparaison juste avec la première maquette, il faudrait trois captures de cette
variante :** 1440 × 900 sans défilement, 390 × 844 sans défilement, et une page lot.
