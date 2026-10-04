# Brief — second design « RUN LAB » pour le dashboard de fermentation

## Ce qui est demandé

Le dashboard de fermentation (`scada-opus-5.5/hakko-dashboard.html`, projet MyFermentLab) doit
recevoir un **second design**, dans le style de la référence « RUN LAB » : sombre, néon, cartes à
grandes valeurs, adapté au téléphone. On y accède par un **bouton dans l'interface**, à côté de
ceux qui existent déjà (thème et vue téléphone). Le **design actuel reste le défaut et ne doit pas
changer** : le second est un ajout, pas un remplacement.

## La règle qui prime sur tout : aucune logique

Cette page **commande de vraies résistances de chauffe**. Un changement d'habillage ne doit
jamais pouvoir en allumer une.

- Tu **ne modifies aucune ligne de JavaScript** : ni la régulation, ni les appels au pont
  (`/api/etat`, `/api/commande`), ni les paliers de sécurité (arrêt après 45 minutes de chauffe
  côté page, 90 minutes côté pont), ni la marque `demo` qui exclut les liens de démonstration de
  la régulation, ni les noms de variables (`REGUL_PAGE_CLE`, `regulMaitre`, `d.allume`, `d.demo`…).
- Tu n'ajoutes **que** : du CSS, un bouton de bascule dans le balisage existant, et **au maximum
  une dizaine de lignes de JavaScript** qui ajoutent ou retirent une classe sur l'élément racine
  et mémorisent le choix (même mécanisme que le thème actuel, que tu réutilises plutôt que
  d'inventer le tien).
- Pas de `!important` sur des règles existantes, pas de réécriture de sélecteurs existants : le
  second design vit sous une classe racine unique (par exemple `runlab`), comme le thème actuel.
- Aucune commande n'est envoyée pendant tes essais. Si tu écris un test, il ne doit jamais
  produire d'appel à `/api/commande`, et **jamais** `allume=true`.

## Contraintes

- **Un seul fichier**, aucune dépendance nouvelle, aucune compilation, aucune ressource externe
  (pas de police à télécharger : tu réutilises la police déjà déclarée ou une pile système).
- Le **bouton** est un vrai contrôle : atteignable au clavier, `aria-pressed` ou `role="switch"`,
  état conservé d'une visite à l'autre, et il disparaît là où il n'a pas de sens si tu suis la
  logique du bouton « Vue téléphone » déjà présent.
- **Téléphone** : le second design doit fonctionner dans le cadre téléphone existant (430 px) et
  sous 900 px en automatique ; zones tactiles ≥ 44 px, champs ≥ 16 px, marges de sécurité iOS
  respectées, aucune barre fixe ne doit recouvrir la fin du contenu.
- **Accessibilité** : contraste du texte ≥ 4,5:1 et des éléments d'interface ≥ 3:1 **sur fond
  sombre** — le piège est le gris des petits libellés, souvent autour de 2,5:1 ; `:focus-visible`
  visible partout ; `prefers-reduced-motion` respecté ; `theme-color` accordé au design actif ;
  chiffres tabulaires ; pas de couleur seule pour porter une information d'état.
- Tout le texte reste **en français**, mêmes libellés, mêmes unités.

## Le style de la référence

La référence image est à `design/captures/reference-run-lab.png` (essaye de l'ouvrir ; si la
lecture est refusée, dis-le). **Une implémentation qui marche déjà de ce style existe** et tu peux
t'en servir comme source des valeurs : `design/captures/canevas-design-b-reference.html` — c'est
le second design du canevas de mémoire, écrit et mesuré. Reprends-en la palette, les surfaces,
l'échelle typographique et les formes de graphiques, en les adaptant au contenu du dashboard.

Couleurs relevées : surfaces `#0A0A0C` (fond) et `#131317` (cartes) avec bordure `#1F1F24`,
lignes internes `#1A1A1F`. Accents : rose `#FF2E7E`, cyan `#4FC3F7`, lime `#A8E063`, ambre
`#FFC93C`, violet `#9C8CF5`, vert d'état `#34D399` sur fond `#0F2E22`. Typographie : titre 17 px
gras blanc ; par carte, un libellé en **capitales 10 px** gris clair avec lettrage espacé
(~1,5 px), puis une **grande valeur 28-34 px** blanche suivie de son **unité en 13 px** en gris
clair, puis une ligne secondaire de 11 px. Rayons 16 px, pas d'ombre : la hiérarchie vient de
l'écart entre surfaces.

Formes : barres verticales arrondies (la barre active en accent, les autres éteintes mais
**lisibles**), anneau de progression à bout arrondi avec le chiffre au centre, barres
horizontales de 8 px avec la valeur alignée à droite, badges en pastille teintée.

## Ce que le dashboard doit montrer dans ce design

Il n'y a pas de série temporelle dans cette page, et **aucun graphique ne doit être inventé**.
Chaque forme correspond à une donnée réelle déjà affichée aujourd'hui :

| Forme de la référence | Donnée réelle du dashboard |
|---|---|
| L'anneau de progression | La chauffe active : durée écoulée sur le plafond de 45 minutes, une prise en cours |
| Le grand chiffre | La température du lot suivi, ou le nombre d'appareils en ligne selon la carte |
| Les barres verticales | Les écarts à la consigne, lot par lot — ou les appareils en ligne / hors ligne |
| Les libellés d'état | `Running` → `En chauffe`, `Idle` → `Au repos`, `Hors ligne`, `À vérifier` |
| La barre d'onglets en bas (téléphone) | Les sections réelles de la page, qui défilent ou se filtrent — jamais des onglets creux |
| Les pastilles d'appareil | Les prises, avec leur état, en conservant les boutons On/Off existants |

## Ce que tu produis

1. `scada-opus-5.5/hakko-dashboard.html` — modifié, design actuel intact.
2. `design/notes-design-runlab-dashboard.md` — ce que tu as fait, ce que tu n'as pas pu faire, ce
   que tu as dû interpréter, et la liste des vérifications à faire ailleurs (tu n'auras
   probablement ni navigateur ni interpréteur : dis-le plutôt que de l'inventer).

## Vérifications qui seront faites après toi, par quelqu'un d'autre

- différence d'images du **design actuel** avant/après : il doit être identique, à l'exception du
  nouveau bouton ;
- diff du JavaScript : la logique de régulation doit être **strictement identique** ;
- contrastes réels du second design, débordement à 390 px, zones tactiles, bascule au clavier,
  retour au premier design ;
- lecture du dashboard sans jamais envoyer de commande aux prises.
