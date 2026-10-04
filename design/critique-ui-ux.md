# Critique de la maquette « Thermographe » au regard de `ui-ux-pro-max`

Objet : `design/maquette-hakko.html`, que je n'ai pas modifiée. La base est citée d'après les
extraits du brief, pris comme source et non comme consigne.

## 0. Ce que j'ai pu regarder, et ce que je n'ai pas pu regarder

- **Les deux captures Edge : pas lues.** L'accès au dossier
  `/mnt/c/Users/Timothée/AppData/Local/hermes/profiles/hakko/cache/scratch/design/` m'a été
  refusé par les permissions de la session. Je n'ai vu ni `maquette-bureau.png`, ni
  `maquette-telephone.png`, et je ne décris donc aucun rendu comme si je l'avais vu.
- **Ce qui remplace les captures, pour la question de la densité :** un **calcul
  géométrique** fait à partir du CSS (hauteurs de ligne, marges, rembourrages, grilles), sur
  la maquette et sur le dashboard de production. C'est une estimation, pas une observation.
  Les retours à la ligne des textes et les métriques réelles d'IBM Plex peuvent la décaler
  d'une rangée. **Vos captures font foi** : si elles me contredisent, c'est elles qui ont
  raison.
- **Mesuré moi-même, en lecture seule :** le nombre de tailles de police déclarées dans la
  maquette (21) et dans la production (16).
- **Mesures que vous avez faites et pas moi :** la conformité « anneaux de focus vérifiés au
  pixel ». De mon côté, je n'ai mesuré que les contrastes des jetons et la structure du
  fichier.

---

## 1. Convergences

### 1.1 Typographie : accord sur le principe, désaccord sur deux emplois

La base propose, pour « Dashboard Data » : **Fira Code** pour les titres, **Fira Sans** pour
le texte, avec la note « *Code for data, Sans for labels* ». La maquette utilise **IBM Plex
Mono** et **IBM Plex Sans**.

**Là où l'accord est réel.** Même structure : une seule famille, déclinée en mono et en
sans, avec le mono pour les données. J'y suis arrivé sans la base, pour une raison de
lecture. Des chiffres qui changent toutes les 3 secondes ne doivent pas faire bouger la
ligne ; la chasse fixe règle cela, en plus de `tabular-nums`. Garder Plex plutôt que Fira
tient à la continuité : la production charge déjà IBM Plex Sans.

**Là où l'accord se défait, sur deux points :**
- **Les libellés.** La base dit « *Sans for labels* ». J'ai mis tous les libellés
  d'instrument en **mono, capitales, 10,5 à 11,5 px, lettres espacées de 0,08 à 0,1 em**
  (surtitres, en-têtes de tableau, `dt` des cotes, graduations). C'est l'effet
  « instrument ». Mais c'est aussi le texte le plus petit de la page, et des capitales
  espacées se lisent moins vite qu'une casse normale. Pour quelqu'un qui lit à un bras de
  distance, cela va contre l'objectif. La base a raison sur ce point.
- **Les titres.** La base met le mono en titre (Fira Code) ; moi, les titres sont en Sans.
  Là, je maintiens mon choix : les titres sont des noms de lots, donc du texte et non des
  données.

**Conclusion.** L'accord est réel sur « données en mono ». Il est faux sur « libellés en
Sans », et c'est ma maquette qui s'écarte de la règle, pas l'inverse.

### 1.2 Graphiques : accord sur la présentation accessible, erreur sur le type

La base, pour « real time temperature line chart », recommande un **Streaming Area Chart**,
**sauf** quand « *Update frequency < 1/min* ». Dans ce cas, elle prescrit un
« *periodic-refresh line chart* ».

**Le cas réel.** La page se rafraîchit toutes les 3 s et interroge le pont toutes les 15 s.
Mais la **grandeur mesurée** évolue en minutes, voire en heures (une fermentation). Je ne
connais pas l'intervalle réel de remontée des sondes Sonoff dans Home Assistant : je ne
l'affirme donc pas. En revanche, la courbe « 24 h » compte 161 points, soit un toutes les
9 minutes environ. Selon la base elle-même, nous sommes dans le cas **periodic-refresh line
chart**, pas dans le streaming.

**Ce que fait la maquette.** Une ligne **avec une aire remplie à 9 %**, sans défilement ni
animation continue. Le type est donc presque le bon, mais l'aire est un emprunt au
streaming qui n'apporte rien : pas de cumul, pas de volume. L'accord que vous voyez tient
pour moitié : **bon comportement, mauvais ornement.**

**Notes d'accessibilité de la base :**

| Exigence de la base | État dans la maquette |
|---|---|
| « *Show the current value and status text* » | **Convergent.** La carte instrument, au-dessus de la courbe, montre la valeur en grand et un badge d'état textuel (« Hors plage ») ; chaque état a aussi une forme distincte. |
| « *Use line styles or markers in addition to color* » | **Convergent.** Consigne en pointillés, plage tolérée en bande, points sur les densités. |
| « *A11y Fallback : Streaming data table plus current-value/trend summary* » | **À moitié.** Le résumé existe (`figcaption` : minimum, maximum, dernière valeur) et chaque point se lit au clavier. **Il n'y a pas de tableau de données.** |
| « *+/- buttons zoom; Reset restores range* » | **Absent.** Les filtres 24 h / 7 j / Tout en tiennent lieu, grossièrement. |

### 1.3 Autres rencontres

- **Hiérarchie des titres** (« *niveaux séquentiels h1→h6* ») : respectée. Chaque page a un
  seul `h1` ; en dessous viennent des `h2`, et les `h3` des cartes de lots. Aucun niveau
  n'est sauté. J'y suis arrivé par la revue Vercel, pas par la base.
- **`data-dense-dashboard`, accessibilité requise :** « *contrast-text-4.5, keyboard,
  visible-focus, reduced-motion* ». Ce sont les quatre points que la revue Vercel m'avait
  déjà fait traiter (voir § 4).
- **`data-dense-dashboard`, effets :**
  - *Hover tooltips* : présents, sous forme d'une bulle sur la courbe.
  - *Row highlighting on hover* : présent sur les lignes de tableau.
  - *Data loading spinners* : un état « Envoi… » existe sur les prises, mais aucun
    chargement de données n'est montré.
- **Pattern Real-Time, couleurs** (« *operational green + incident red + maintenance
  amber* ») : c'est exactement la sémantique ok / hors plage / écart léger de la maquette.
  Elle est héritée du `status()` de production.
- **Largeur de la colonne latérale :** la base prescrit `--sidebar-width:240px`, j'ai
  236 px. Aucun mérite, c'est la valeur de la production.

---

## 2. Divergences

| Point | La base dit | La maquette fait | Écart subi ou choisi |
|---|---|---|---|
| **Thème** | Dark Mode (OLED), clair « *not-recommended* » | papier clair chaud par défaut en mode auto, sombre « cave » selon le système | **choisi**, voir 2.1 |
| **Couleur primaire** | vert `#16A34A` | indigo `#2F3E8E` ; le vert est réservé à « ok » et à « allumée » | **choisi**, voir 2.2 |
| **Densité** | 8/10, rembourrage 8 à 12 px, corps 12 à 14 px, lignes de 36 px | cartes à 18 px de rembourrage, lecture de 52 à 112 px, lignes de tableau d'environ 47 px | **choisi pour le téléphone, subi sur le bureau**, voir § 3 |
| **Échelle typographique** | modulaire 12, 14, 16, 18, 24, 32 | **21 tailles distinctes** en px (plus un `clamp` et un `em`), dont seulement 12, 14, 18 et 24 figurent dans l'échelle ; la production en avait 16 | **subi** : j'ai aggravé l'héritage |
| **Fil d'Ariane** | « *Do pour 3 niveaux et plus · Don't pour un site plat* » | fil présent partout, alors que le site a 2 niveaux au plus (Recettes › Saison du Nord). Au premier niveau, il répète le `h1` | **subi**, hérité de la production sans remise en question |
| **Télémétrie « live »** | « *Label telemetry as live only when backed by a current source, with update time and stale state* » | pastille « En direct » et horloge qui avance toutes les 3 s **alors qu'aucune source n'existe** (valeurs figées, aucun réseau). Aucun âge de mesure à côté des grands chiffres, aucun état périmé | **subi, et c'est le plus grave** : voir 2.3 |
| **Travail hors écran** | « *stop offscreen/hidden work* » | `setInterval` de 3 s qui tourne même onglet masqué | **subi** |
| **Tableaux** | `sticky headers`, `--table-row-height:36px` | en-têtes non collants, lignes d'environ 47 px | **subi sur le bureau**, **choisi en mode fiches sur téléphone** (cibles de 44 px) |
| **Animations de filtre** | « *smooth filter animations* » | aucune : un filtre redessine sans mouvement | **choisi** (motion 3/10 de la base elle-même, et une seule chorégraphie à l'arrivée) |

### 2.1 Le thème : je défends le clair par défaut, avec deux réserves

**Les faits dont je dispose** (brief de la maquette) : une personne seule, « *souvent debout
dans une cuisine ou un garage, souvent sur son iPhone* ».

**Pourquoi le clair.**
- **En cuisine éclairée :** un fond sombre sur un écran brillant renvoie le plafonnier et
  le visage. En forte lumière ambiante, un fond clair et un texte foncé se lisent mieux
  qu'un fond noir avec un texte clair.
- **Au garage le soir :** la maquette n'impose pas le clair. Le mode par défaut est
  **auto** : il suit le réglage de l'iPhone, et donc son passage automatique au sombre à
  la tombée de la nuit.
- **L'argument OLED de la base** (économie d'énergie) est vrai en principe sur iPhone. Il
  est négligeable pour une page consultée trente secondes.

**Ce que je ne sais pas.** À quelles heures la page est réellement consultée, et sous
quelle lumière dans ce garage. S'il s'agit surtout de consultations nocturnes dans un
garage sombre avec un téléphone réglé en clair, le choix tient moins bien. Et **le thème
sombre de la maquette est secondaire** : ses contrastes sont calculés (0 échec), mais je ne
l'ai jamais vu, et la lueur comme le grain du fond ont été réglés d'abord pour le clair.

### 2.2 Le vert primaire : refus argumenté

La base veut à la fois le vert comme **couleur primaire** (boutons, action) et le vert comme
**« operational green »** (état ok). Faire les deux, c'est donner deux sens à la même
couleur. Un bouton « Appliquer la consigne » vert, à côté d'un badge « Dans la cible » vert,
brouille ce que le vert signifie. La maquette garde un indigo pour l'action et réserve le
vert à l'état. C'est la base qui se contredit ici, pas la maquette.

### 2.3 L'absence d'état périmé : un défaut que ma direction aggrave

La direction « Thermographe » affiche la température **en très grand**. Si une sonde cesse
de remonter (pile morte, Zigbee décroché), la maquette continue d'afficher « 21,3 » en
56 px, sans âge ni grisé. Le grand chiffre augmente la confiance qu'on lui accorde. **Plus
la mesure est grande, plus son âge doit être visible.** La production a le même trou, mais
en petit. C'est l'écart le plus important de cette critique, et le Pattern Real-Time de la
base le désigne exactement.

---

## 3. Le point dur : la densité, chiffres à l'appui

**Question.** « Mes lots sont-ils à la bonne température ? » : il y a 4 lots en cours.
Combien sont visibles **en entier** (réglette comprise) sans défiler ?

**Méthode.** Calcul à partir du CSS ; voir § 0 pour les limites.
- **Vue d'ensemble de la maquette à 1440 × 900 :**
  - Barre du haut 64 px, rembourrage 30, en-tête environ 59 + 22, bandeau d'alerte environ
    70 + 22, bande d'indicateurs environ 121 + 26, titre de section environ 44 : **les lots
    commencent vers 460 px**.
  - Colonne des lots : 1 440 − 236 − 64 − 350 − 22 = **768 px**, soit **2 colonnes** (la
    carte fait 330 px au minimum).
  - Une carte de lot fait **environ 308 px**.
  - Première rangée : 460 à 770 px. Seconde rangée : 780 à 1 090 px.
- **Production à 1440 × 900** (vue « écran unique ») :
  - Les lots commencent vers 290 px, dans une zone qui défile en interne, limitée à la
    hauteur de la fenêtre.
  - 2 colonnes de cartes d'environ 234 px, deux rangées entre 290 et 790 px environ.
- **Téléphone (430 × 932), maquette :**
  - Barre 64, en-tête avec boutons en pleine largeur environ 112 + 22, bandeau d'alerte
    replié sur 3 à 4 lignes environ 175 + 22, indicateurs 2 × 2 environ 246 + 26, titre 44 :
    **la première carte commence vers 730 px**.
  - La barre d'onglets basse occupe environ 67 px, donc la zone utile s'arrête vers 865 px.
- **Téléphone, production :** la première carte finit vers 665 px ; la seconde commence
  vers 675 px et déborde.

| Écran | Production | Maquette |
|---|---|---|
| Bureau 1440 × 900 | **4 lots sur 4** en entier | **2 lots sur 4** en entier, 2 autres coupés vers le haut du chiffre |
| Téléphone 430 × 932 | **1 lot** en entier (+ 1 coupé) | **0 lot** en entier : la première carte est coupée au niveau de son chiffre |

**Je tranche.**
- **Sur le bureau à 1440 px, la maquette ralentit la vérification.** Il faut défiler pour
  voir la moitié des lots. Chaque lot se lit plus vite (aiguille contre plage) mais, pour
  la question posée, **le coût du défilement l'emporte** : 2 lots sur 4, contre 4 sur 4.
  Sur ce point, la base a raison.
- **Sur le téléphone, c'est pire, et c'est là que je ne l'attendais pas.** La cause n'est
  pas la taille des chiffres, c'est **l'ordre** : le bandeau d'alerte et les quatre
  indicateurs passent avant les lots, et repoussent la première température hors de
  l'écran. La direction voulait « lire la température d'un coup d'œil, debout, téléphone en
  main » ; la mise en page de la vue d'ensemble l'en empêche. **Il faut le corriger avant
  toute autre chose.**
- **Ce que je maintiens.** Sur la **page d'un lot**, la grande lecture (68 à 112 px) et la
  grande réglette sont justifiées : on n'y regarde qu'un seul lot. La densité 8/10 de la
  base est pensée pour un analyste assis devant une BI ; ce n'est pas ce cas-là.

---

## 4. Les quatre exigences de la base : ce qui reste fragile

Les quatre exigences sont remplies : contraste 4,5:1, clavier, focus visible, mouvement
réduit. Cela ne dit pas qu'elles tiendront.

**Contraste.**
- Le « 0 échec » que j'ai mesuré porte sur des **paires de jetons**, pas sur chaque texte
  rendu.
- La marge la plus faible est **4,74:1** : `--sourd` sur le fond texturé, dans le pire cas
  (lueur, trait de grille et grain superposés). Il suffit de monter la lueur ou le grain
  d'un cran pour repasser sous 4,5, et c'est déjà arrivé une fois (4,05:1 dans ma première
  version).
- Les **barres translucides** (barre du haut à 76 %, barre d'onglets à 90 %, toutes deux
  floutées) : leur contraste dépend de ce qui défile dessous. **Pas mesuré.**
- La **piste de la réglette** sous la couleur bière est à **3,34:1**, pour un seuil de 3.

**Clavier.**
- Après chaque action, la vue est redessinée en entier (`innerHTML`), puis le focus est
  remis sur « l'élément équivalent », retrouvé par `id` ou `data-action`. Tout élément
  interactif ajouté plus tard sans l'un des deux perdra le focus en silence.
- Le toast « Annuler » est placé en fin de document et disparaît en 7 s, même si le focus
  est dessus : au clavier, il est atteignable en théorie, mais difficilement à temps.

**Focus visible.**
- Sur les cartes et les lignes, l'anneau dépend de `:has()`. Sans lui, l'anneau reste
  autour du texte du lien, plus petit.
- Sur le pas à pas de consigne, l'anneau est **à l'intérieur** du contrôle (décalage
  négatif, parce que le conteneur est en `overflow:hidden`). Il est visible, mais plus
  discret que partout ailleurs.

**Mouvement réduit.**
- Correctement coupé, mais seulement **pour les animations CSS**. Les mises à jour de texte
  toutes les 3 s continuent (horloge, « il y a… »), ce qui est acceptable.
- En revanche, le travail tourne même onglet masqué, contre « *stop offscreen/hidden
  work* ».
- Je n'ai **jamais vu** la page avec `prefers-reduced-motion`.

**Le fond du problème.** Les quatre exigences sont remplies sur une page **qui ment sur la
fraîcheur de ses données** (§ 2.3). Une interface techniquement accessible qui affiche en
très grand une valeur peut-être périmée n'est pas une interface sûre.

---

## 5. Actions classées

### 5.1 Sans toucher à la direction (par priorité)

| # | Changement | Règle de la base qui le motive | Risque si c'est mal fait |
|---|---|---|---|
| 1 | Afficher **l'âge de chaque mesure** sous le grand chiffre (« il y a 40 s »). Au-delà d'un seuil, **griser le chiffre et hachurer l'aiguille** avec un libellé « mesure périmée ». Retirer « En direct » quand aucune source ne répond. | Pattern Real-Time : « *live only when backed by a current source, with update time and stale state* » | Seuil mal choisi : fausses alertes si la sonde ne remonte qu'au changement de valeur. Je ne connais pas son intervalle, il faut le mesurer avant de fixer le seuil. |
| 2 | **Téléphone : la première température au-dessus de la ligne de flottaison.** Les lots passent avant les indicateurs ; les quatre indicateurs se réduisent à une ligne (« 3 écarts · 9/9 en ligne · 2 chauffes ») ; le bandeau d'alerte tient sur une ligne, repliable. | `data-dense-dashboard` « *maximum data visibility* » ; graphiques « *current value at a glance* » | L'alerte appareil perd de sa visibilité. Elle doit rester en tête, sur une ligne, pas disparaître. |
| 3 | **Bureau : 4 lots visibles à 1440 × 900.** Rembourrage des cartes de 18 à 12 px ; lecture de 56 à 40 px sur la vue d'ensemble seulement ; indicateurs en bande compacte d'environ 70 px ; bandeau fusionné dans l'indicateur « Appareils ». | `--card-padding:12px`, `--grid-gap:8px`, densité 8/10 | La réglette réduite sous environ 220 px de large devient illisible (graduations serrées). Ne pas appliquer ces tailles au téléphone. |
| 4 | **Ramener 21 tailles de police à l'échelle 12, 14, 16, 18, 24, 32**, plus une seule taille « lecture », hors échelle et assumée. | Typography / Font Size Scale (sévérité moyenne) | Des retours à la ligne en cascade dans les en-têtes de tableau et les indicateurs ; à revérifier à 390 px. |
| 5 | **Libellés d'instrument en Sans 12 px, casse normale**, au lieu de mono capitales de 10,5 à 11,5 px. Le mono reste réservé aux valeurs. | « *Code for data, Sans for labels* » | Perte d'une partie du caractère « instrument ». C'est acceptable : la réglette porte l'identité, pas les petites capitales. |
| 6 | Courbe : **retirer l'aire remplie**, ajouter un **tableau de données** repliable (agrégé par heure) sous la courbe. | « *periodic-refresh line chart* » pour une fréquence < 1/min ; « *A11y Fallback : data table* » | Un tableau de 161 lignes est inutilisable : il faut l'agréger, sinon il noie le lecteur d'écran. |
| 7 | **Suspendre la mise à jour quand l'onglet est masqué**, et rafraîchir immédiatement au retour. | « *stop offscreen/hidden work* » | Sans rafraîchissement au retour, des valeurs vieilles de plusieurs heures s'affichent (retour au n° 1). |
| 8 | **Fil d'Ariane seulement au deuxième niveau**, comme lien de retour ; au premier niveau, rien (le `h1` suffit). | Navigation / Breadcrumbs : « *Don't pour un site plat* » | Sur téléphone, la barre du haut perd son seul repère de page : garder le titre court à sa place. |
| 9 | **Tableaux du bureau** : lignes de 36 px et en-têtes collants. Sur téléphone, garder les fiches et les cibles de 44 px. | `--table-row-height:36px`, « *sticky headers* » | Des en-têtes collants sous une barre collante de 64 px : prévoir le décalage, sinon ils se chevauchent. |
| 10 | Augmenter la marge de contraste sur le fond : lueur atténuée derrière les zones de texte, ou `--sourd` d'un cran plus foncé ; **mesurer** les barres translucides. | « *contrast-text-4.5* » | Un fond qui s'éteint, et la direction perd son atmosphère. |

### 5.2 Seulement en changeant de direction (listé, pas proposé)

| Changement | Règle de la base | Pourquoi ce n'est pas un ajustement |
|---|---|---|
| Sombre OLED par défaut, clair déconseillé | Système proposé : « *Dark Mode (OLED)* » | Le papier chaud **est** la direction ; l'inverser, c'est une autre maquette. |
| Densité 8/10 partout : grille à 12 colonnes, corps de 12 à 14 px, cartes compactes jusque sur téléphone | `data-dense-dashboard`, CSS et variables | La lecture à un bras de distance, qui est la raison d'être de la direction, disparaît. |
| Vert comme couleur primaire | Colors : primary `#16A34A` | Cela casse la règle interne « vert = ok » : c'est un autre système de couleurs. |
| Graphique en streaming, jauge mouvante, bandeau défilant | Best Chart Type : Streaming Area, Moving Gauge, Ticker Tape | Cela contredit « une seule chorégraphie à l'arrivée » et le « *When NOT to use* » de la base elle-même. |

---

## 6. Ce que je refuse de changer

- **Le vert réservé à l'état**, jamais à l'action (§ 2.2). La base se contredit ; la
  sémantique ok / écart / hors plage vaut plus qu'une couleur de marque.
- **Le mode auto avec le clair comme référence.** Il suit l'iPhone, donc le soir comme le
  jour. Imposer le sombre dégraderait la cuisine éclairée, qui est le cas décrit. Je réviserai
  si des données d'usage montrent l'inverse (§ 2.1).
- **IBM Plex au lieu de Fira.** La structure mono + sans est la même, le gain est nul, et la
  production charge déjà Plex. Fira Code apporte en plus des ligatures de code (`->`, `!=`)
  qui n'ont rien à faire dans des mesures.
- **La grande lecture et la grande réglette sur la page d'un lot.** On y regarde un lot, pas
  une flotte : la densité n'y a pas de sens.
- **Le corps de 16 px des champs sur téléphone** et les cibles de 44 px. La base propose 12 à
  14 px de corps, mais Safari iOS zoome sous 16 px, et une main mouillée en cuisine ne vise
  pas 36 px.
- **Aucune animation de filtre.** La base les liste parmi les effets du style, mais son propre
  réglage de mouvement est à 3/10. Une arrivée soignée suffit ; ajouter du mouvement à chaque
  clic de filtre serait de la décoration.

Ce que je **ne refuse pas**, même si cela coûte à la direction : la densité de la vue
d'ensemble (actions 2 et 3) et l'état périmé (action 1). Sur ces deux points, la base avait
raison et la maquette avait tort.
