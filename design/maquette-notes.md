# Maquette Hakko — notes de design

Fichier : `design/maquette-hakko.html` (1 515 lignes, un seul fichier, HTML, CSS et JS natifs,
ouvrable par double-clic). Seule ressource externe : Google Fonts. Aucun fichier existant
modifié : `scada-opus-5.5/hakko-dashboard.html` a la même empreinte sha256 avant et après
(`e3e6586d…bf9`).

> **Ce que je n'ai pas pu faire : ouvrir la page dans un navigateur.** Node n'est pas installé
> dans l'environnement, et l'exécution de `chromium` (présent dans `/usr/bin`) m'a été refusée
> par les permissions de la session. Je n'ai donc **vu aucun rendu** : ni capture, ni mesure
> dans le DOM, ni exécution du JavaScript. Ce qui est mesuré l'a été par script, sans
> navigateur (voir « Mesures »). La sonde navigateur est prête et n'attend que d'être lancée.

## 1. La direction : « Thermographe »

Méthode imposée par la compétence design, appliquée telle quelle : **une** direction nommée
en tête du CSS, **un** élément mémorable qui porte une donnée, deux familles de polices,
règle 70/20/10, fond avec de l'atmosphère, un mouvement orchestré plutôt que dispersé.

**L'idée.** L'enregistreur de température à tambour des caves et des labos : papier
millimétré chaud, encre noire, aiguille posée sur une graduation. La page se lit comme un
**instrument**, pas comme un tableau de bord de bureau.

**Pourquoi.** La personne est debout, dans une cuisine ou un garage, téléphone en main. Elle
a une seule question : « mes lots sont-ils à la bonne température, et la chauffe
tourne-t-elle ? ». Le dashboard actuel répond avec des cartes grises de 14 px, bien faites
mais pensées pour un bureau. Ici, la température fait 52 à 112 px en chasse fixe. Sa
position par rapport à la cible se lit sans lire un chiffre.

**L'élément mémorable : la réglette thermique.** C'est une donnée, pas un décor. Sur chaque
carte de lot et en tête de la page d'un lot, une piste va du froid au chaud et porte :
- la plage tolérée dans la couleur du type de fermentation : bande large à ± tolérance,
  bande juste à ± demi-tolérance, soit exactement les seuils de `status()` ;
- un trait noir à la consigne ;
- l'aiguille de la mesure, colorée selon l'état (vert, orange ou rouge).

Sans sonde, il n'y a pas d'aiguille. À l'arrivée sur la page, l'aiguille part du froid et se
pose sur sa valeur en 400 ms, en n'animant que `transform`.

**Typographie.**
- **IBM Plex Sans** pour le texte : on garde la continuité avec l'existant.
- **IBM Plex Mono** pour toutes les mesures et les libellés d'instrument (petites capitales
  espacées). La chasse fixe aligne naturellement les chiffres, et `tabular-nums` reste posé.
- Chargement Google Fonts avec `display=swap`. Repli complet :
  `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', 'Noto Sans'` et
  `ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono'`. J'ai retiré Roboto, présent
  dans la pile de repli de l'existant.

**Couleurs (70/20/10).**
- **70 %** : papier washi chaud (`#F1ECE2`, cartes `#FCFAF6`).
- **20 %** : encre (`#1E1A15`).
- **10 %** : un indigo « ai » franc (`#2F3E8E`) pour l'action et le focus. C'est la
  modernisation du bleu `--accent` existant, qui garde son rôle.
- Le **vermillon** est réservé à une seule chose : **la chauffe** (température = chaud).
- Ok, écart et hors plage gardent le vert, l'orange et le rouge.
- `--biere`, `--miso`, `--koji`, `--garum` gardent leur teinte, assombrie en clair et
  éclaircie en sombre pour tenir 3:1.
- Thème sombre, « la cave » : même papier, lu à la lampe.

**Atmosphère.** Au lieu d'un aplat gris : une lueur d'étuve orangée en haut à gauche, un
contre-jour indigo à droite, une grille millimétrée de 24 px (le papier du thermographe) et
un grain SVG (`feTurbulence`) en data URI. Aucune image externe.

**Mouvement.** Une seule chorégraphie, à l'arrivée sur une page :
- les blocs montent en cascade (380 ms, 55 ms d'écart) ;
- les aiguilles se posent et les barres de progression se remplissent (400 ms).

Sinon : le curseur des interrupteurs (200 ms), un léger soulèvement des cartes au survol
(220 ms), l'ouverture du dialogue et du toast (240 ms). Tout passe par `transform` et
`opacity`, sans jamais `transition: all`. Rien de tout cela n'existe sous
`prefers-reduced-motion: reduce` : les règles sont enfermées dans
`@media (prefers-reduced-motion: no-preference)`.

## 2. Ce qui a changé par rapport à l'existant

**Même application, mêmes données.**
- Mêmes sections : vue d'ensemble (4 indicateurs, cartes de lots, activité récente, état des
  appareils), page d'un lot (mesure, consigne, courbe, progression, journal, appareils,
  paramètres), appareils (tableau et multiprise), recettes (liste et fiche), archive (liste
  et lot archivé).
- Mêmes intitulés.
- Mêmes règles de calcul, reprises du fichier : `status()`, `progress()`, hystérésis de
  0,2 °C, `model()` pour les courbes simulées, `fmtDur()`.
- Valeurs réelles : 21,3 / 21,4 / 26,9 °C et 56,9 %, 5 prises `switch.smart_switch_…_outlet_1..5`,
  4 lots en cours et 1 archivé, 6 recettes.

**États montrés, tous issus des vraies valeurs :**
- **hors plage** : Saison 21,3 °C pour une cible de 24 ; koji 26,9 pour 30 ;
- **écart léger** : miso 21,4 pour 18, tolérance 4 ;
- **sans sonde** : garum ;
- **échu** : koji ;
- **prise allumée** : prises 1 et 2, allumées par la règle d'hystérésis avec ces mesures ;
- **alerte** : `switch.shellyazplug_e4b3232e116c` indisponible, en bandeau et dans le fil ;
- **donnée manquante** : puissance non mesurée, température du garum « — ».

**Données inventées ou déplacées (le strict minimum).**
- Le koji démarre il y a **50 h** au lieu de 26 h, pour montrer l'état « échu » (la recette
  dit « récolter entre 44 et 48 h »). C'est la seule valeur réelle modifiée.
- Deux événements de chauffe dans le journal (prises 1 et 2 à 21,3 et 26,9 °C). Ce sont ceux
  que la régulation produirait avec ces mesures.
- **Plus aucun watt affiché.** La multiprise Meross MSS425f ne mesure pas la puissance
  (commit 0426676). Les 160 à 410 W de l'existant étaient inventés. La maquette affiche
  « — / Non mesurée par la multiprise ».
- Les courbes restent simulées par `model()`, comme dans l'existant hors pont. Leur fin
  rejoint en douceur la vraie valeur de la sonde, sinon la courbe sauterait de 24 à 21,3 °C
  au dernier point.
- Les statistiques de l'archive sont calculées sur ce même modèle, comme `archStats()`.

**Défauts de la revue corrigés dans la maquette** (`design/revue-actuelle.md`) :
- **Focus.** Un seul anneau `:focus-visible` de 2 px en indigo, pour tout, champs compris.
  Aucun `outline:none` sans remplacement : les deux seuls concernent `<main>` (cible du lien
  d'évitement, non interactif) et le lien étiré, dont l'anneau passe à la carte ou à la
  ligne entière. Le champ de consigne a son anneau à l'intérieur du pas à pas (c'était le
  trou de la l. 353).
- **Lignes cliquables.** Ce sont désormais de vrais liens `<a>` étirés sur la ligne, donc
  accessibles au clavier, avec clic du milieu. Idem pour les cartes de lots.
- **Structure et navigation.**
  - Lien d'évitement, `aria-label` sur les deux `<nav>`, fil d'Ariane en `<ol>` avec
    `aria-current`.
  - Toutes les icônes en `aria-hidden`.
  - Onglets remplacés par des groupes de boutons `aria-pressed`, pour ne pas simuler un
    `tablist` sans son comportement clavier.
  - Progression en `role="progressbar"`, dialogue nommé par `aria-labelledby`.
- **Annonces vocales (`aria-live`) :**
  - région persistante `#annonce` pour les suites d'action (prise allumée, consigne
    appliquée, note ajoutée) ;
  - indicateur « Écarts » et lecture de la courbe au clavier en `aria-live`.
  - L'heure de synchro n'est volontairement **pas** annoncée : elle change toutes les 3 s.
  - Les valeurs et badges sont mis à jour en place (`textContent`), au lieu d'un
    `outerHTML` qui détruit les nœuds.
- **Courbe.** Utilisable au clavier (flèches, Maj + flèches, Origine, Fin), avec un résumé
  textuel (`figcaption`) : minimum, maximum, dernière valeur.
- **Formulaires.**
  - Erreurs affichées sous le champ, `aria-invalid`, focus renvoyé sur le champ fautif, et
    toujours une étape suivante (« par exemple 1,007 »).
  - Placeholders terminés par `…`, `autocomplete="off"`, `inputmode="decimal"` : on peut
    saisir « 1,007 » avec une virgule.
  - Commande de prise avec un état « Envoi… » (`aria-busy`) : impossible de l'envoyer deux
    fois.
  - Suppression d'un relevé de densité annulable pendant 7 s (toast « Annuler »).
  - Focus automatique dans le dialogue seulement avec un pointeur fin (pas sur téléphone).
- **Multiprise.** Le bouton de prise est un `role="switch"` au texte visible
  « Allumée » / « Éteinte », inclus dans son nom accessible. Le rouge ne signifie plus
  « éteint ».
- **URL.** Filtres, période, courbe, onglet de recettes et recherche vivent dans l'URL
  (`#/appareils?filtre=plug`, `#/f/b1?courbe=grav`…), mis à jour par `replaceState`. Une
  frappe dans la recherche ne redessine que la liste, pas la page.
- **Typographie et formats.**
  - Espace fine insécable (U+202F) entre nombre et unité.
  - `Intl.NumberFormat`, `Intl.DateTimeFormat` et `Intl.RelativeTimeFormat` partout.
  - `text-wrap: balance` sur les titres, `overflow-wrap:anywhere` sur les identifiants
    Home Assistant, `translate="no"` sur la marque et les identifiants.
- **Thème.** `<meta name="theme-color">` en deux variantes, clair et sombre, recalées par le
  bouton de thème. L'état courant du thème figure dans l'`aria-label` du bouton.
- **Toucher.** `touch-action: manipulation`, `-webkit-tap-highlight-color` remplacé par des
  états `:active`, `overscroll-behavior: contain` sur le dialogue et les listes qui défilent.
  `scroll-padding` haut et bas : la barre collante et la barre d'onglets ne couvrent plus
  l'élément focalisé.
- **États et formes.** Chaque état a sa **forme** en plus de sa couleur (rond = ok,
  triangle = écart, losange = hors plage, pointillés = sans sonde) : lisible sans percevoir
  les couleurs.

**Mobile.** Le comportement existant est conservé, simplifié à la source :
- Sous 900 px, la colonne latérale laisse place à une barre d'onglets basse (Accueil,
  Archive, Recettes, Appareils, dans cet ordre).
- Cibles de 44 px minimum : boutons, filtres, champs et icônes passent à 44 px. La zone
  touchable de l'interrupteur est étendue par un pseudo-élément à 45 px. Les boutons de
  prise font 48 px.
- Champs en 16 px, y compris dans le dialogue.
- `env(safe-area-inset-*)` sur la barre du haut, la barre d'onglets, le contenu et le toast.
- **Changement de technique : requêtes de conteneur** (`@container cadre`). La vue
  téléphone forcée se réduit donc à « cadre de 430 px ». L'existant recopiait à la main
  environ 50 règles `@media` sous `html.vue-tel` (l. 517-581) ; cette recopie disparaît.
- Sur la page d'un lot, l'ordre du HTML est l'ordre de lecture du téléphone : mesure,
  consigne, courbe, progression, journal. Sur grand écran, `grid-template-areas` le répartit
  en deux colonnes sans désordonner le clavier ni le lecteur d'écran.

## 3. La seconde direction, non codée

**« Cadran d'étuve ».** Fond noir profond et chiffres en segments lumineux (Plex Mono
600, lueur ambre), une jauge circulaire par lot où l'arc de progression entoure la
température. Plus spectaculaire la nuit dans le garage, mais moins lisible en plein jour en
cuisine et plus coûteuse en place sur téléphone : écartée au profit du Thermographe.

## 4. Ce qui n'est pas traité

- **Le formulaire de recette** (création et édition, lignes d'ingrédients et d'étapes) et le
  bouton « Nouvelle recette » : absents. La fiche recette est en lecture seule, avec
  « Lancer une fermentation ».
- **Archiver ou restaurer une recette**, **supprimer un lot archivé** : absents.
- **Le pont Home Assistant** (jeton, `/api/`, régulation automatique cadencée, coupure de
  sécurité) : volontairement absent. La maquette ne fait aucune requête et n'enregistre
  rien (`localStorage` ne garde que le thème et la vue téléphone). Tout se réinitialise au
  rechargement.
- **Données non mises à jour.** Les mesures ne bougent pas : la mise à jour en place
  toutes les 3 s existe (heure, « il y a… », valeurs, badges), mais les valeurs sont fixes.
- **Préchargement des polices.** Pas de `<link rel="preload" as="font">` : les URL des
  fichiers Google Fonts ne sont pas stables.
- **Le toast d'annulation** disparaît au bout de 7 s. Il n'est pas prolongé quand le focus
  est dessus.
- **Sans `:has()`** (navigateurs antérieurs à 2023), l'anneau du lien étiré reste autour du
  texte du lien au lieu de toute la carte. Il reste visible, simplement plus petit.

## 5. Mesures faites (et leurs limites)

Les scripts sont dans `design/_mesures/`. Rien n'y a été exécuté dans un navigateur.

| Mesure | Outil | Résultat |
|---|---|---|
| Contraste des jetons, 38 paires × 2 thèmes (texte ≥ 4,5:1, interface ≥ 3:1) | `contraste_jetons.py` | **0 échec**. Plus faible texte : 4,90:1 en clair, 5,68:1 en sombre. Plus faible élément d'interface : 3,34:1 en clair (bière sur piste vide), 3,61:1 en sombre |
| Texte posé sur le fond d'atmosphère, pire cas (lueur maximale + trait de grille + grain maximal) | `contraste_fond.py` | `--sourd` 4,74:1 en clair, 5,14:1 en sombre. **Première version à 4,05:1** : le grain était 4× trop fort et `--sourd` trop clair, les deux ont été corrigés |
| Balises HTML statiques | `verif_statique.py` (html.parser) | toutes fermées, aucune erreur |
| Accolades CSS | idem | 417 / 417 |
| Parenthèses, crochets, accolades, chaînes, gabarits imbriqués et regex du JS | idem (tokeniseur maison) | équilibrés dans les deux `<script>` |
| `id` appelés par le JS absents du document | idem | aucun |
| `data-action` sans gestionnaire, gestionnaire sans déclencheur | idem | aucun, aucun |
| `transition: all`, propriétés animées | idem | aucun ; seulement `transform` et `opacity`, durées de 200 à 400 ms |
| `outline:none` | idem | 2 occurrences, toutes deux avec remplacement ou sur un élément non interactif (détail au § 2) |
| Polices exclues (Inter, Roboto, Arial) | idem | aucune ; deux familles déclarées : IBM Plex Sans et IBM Plex Mono |
| Fichier de production non modifié | `sha256sum` | identique avant et après |

**Non mesuré, donc non garanti :**
- **Le rendu réel.** Mise en page, débordement horizontal à 390 px, zones réellement
  touchables (≥ 44 px) et chargement des polices n'ont jamais été vus.
- **L'exécution du JavaScript.** Il a été relu en entier et vérifié structurellement, mais
  pas exécuté : une erreur d'exécution reste possible.
- **Le contraste de chaque texte dans le DOM rendu.** Mesuré au niveau des jetons seulement.
- **L'arrêt effectif des animations** sous `prefers-reduced-motion`.

**Pour lancer la sonde navigateur** qui mesure tout cela (13 routes, erreurs JS, débordement,
zone touchable par `elementFromPoint`, anneau de focus de chaque élément, taille des champs,
contraste de chaque texte rendu dans les deux thèmes, animations à l'arrivée, bascule de
prise, consigne invalide) :

```sh
chromium --headless=new --no-sandbox --window-size=390,844 --virtual-time-budget=150000 \
  --dump-dom "file://$PWD/design/_mesures/sonde.html"
chromium --headless=new --no-sandbox --window-size=1440,900 --virtual-time-budget=150000 \
  --dump-dom "file://$PWD/design/_mesures/sonde.html"
chromium --headless=new --no-sandbox --force-prefers-reduced-motion --window-size=390,844 \
  --virtual-time-budget=150000 --dump-dom "file://$PWD/design/_mesures/sonde.html"
```

Le résultat sort en JSON dans `<pre id="resultat">`. `sonde.html` est une copie de la
maquette finale, à laquelle seule une balise `<script src="sonde.js">` a été ajoutée ; la
maquette elle-même n'est pas instrumentée.
