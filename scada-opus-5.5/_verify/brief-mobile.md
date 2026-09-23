# Brief — adaptation mobile de `hakko-dashboard.html`

## Contexte

Une page HTML autonome, `hakko-dashboard.html` (1783 lignes, fins de ligne CRLF), qui
supervise des fermentations et commande de **vraies prises électriques** via un pont
local (`fetch('api/…')` sur la même origine). Aucune dépendance, aucun build, aucun CDN,
tout est inline : `<style>` et `<script>` dans le même fichier.

C'est la reconstruction d'un dashboard existant, avec une contrainte dure : **sur
ordinateur, le rendu doit rester identique**. Toute règle mobile doit donc être
conditionnelle (`@media` ou classe posée sur `html`), jamais une modification du style
de base.

## Ce que l'utilisateur a décidé (déjà tranché, à respecter tel quel)

1. La version mobile vit **dans le même fichier**, plus un **bouton « Vue téléphone »
   dans la barre du haut** qui force la présentation mobile quelle que soit la largeur.
   Pas de second fichier, pas de second port : la logique de commande des prises
   (régulation, freins, coupure de sécurité après 90 min) doit rester **unique**.
2. Sur téléphone, l'**interrupteur des prises** doit être agrandi : environ **56 × 32 px
   visibles**, et une **zone tactile d'au moins 44 × 44 px** (un pseudo-élément qui
   déborde du cadre visible est acceptable). Sur ordinateur il ne change pas.
3. L'utilisateur se sert de ce dashboard au doigt, sur un iPhone 15 Pro Max, en Safari,
   sur le réseau local (192.168.1.51:30090).

## Ce que j'ai mesuré (à exploiter, pas à refaire)

Page déployée, iPhone 15 Pro Max émulé, 430 × 932 points CSS, densité 3 :

| Constat | Mesure |
|---|---|
| Vue d'ensemble « Lots en cours » **écrasée** : la grille reste à 2 colonnes, titres et températures coupés | visible à l'œil ; la mesure de débordement ne voit rien |
| Page Appareils : **onglets de filtre coupés** (« Prises » hors écran), défilement latéral | **16 px** de débordement, 3 éléments hors cadre |
| Cibles tactiles sous 44 px | **6** sur la vue d'ensemble, **17** sur Appareils |
| Détail des cibles trop petites | interrupteur **36 × 20**, boutons d'icône 34 × 34, filtres 30 px de haut, boutons 30 à 36 px de haut |
| Déjà en place et fonctionnel | sous 900 px : colonne latérale masquée, barre d'onglets basse (4 rubriques, 64 px), tableaux transformés en fiches, `env(safe-area-inset-*)` géré |
| Vue d'ensemble / Archive / Recettes | **0 px** de débordement — rien à corriger |
| Plus petit texte | 11,5 px |

Captures de la page **déployée** (téléphone émulé), à ouvrir pour juger la composition :

- `/mnt/c/Users/Timothée/AppData/Local/hermes/profiles/hakko/cache/scratch/mobile/mobile-accueil.png`
- `/mnt/c/Users/Timothée/AppData/Local/hermes/profiles/hakko/cache/scratch/mobile/mobile-appareils.png`

## Ce que tu dois produire — trois livrables

1. **`scada-opus-5.5/_verify/spec-mobile.md`** — la spécification mobile **normative** :
   pour chaque correctif, la règle CSS exacte (sélecteur + déclarations), en réutilisant
   les tokens déjà définis dans le fichier (`--accent`, `--line`, `--surface`, `--muted`…)
   et en nommant explicitement, pour chaque symbole absent du jeu de tokens, celui qui le
   remplace. Pas de valeurs « à peu près » : des valeurs, et pourquoi elles.
   Règles attendues au minimum : la grille de la vue d'ensemble à une colonne ; la barre
   d'onglets de filtres qui ne déborde plus ; l'interrupteur agrandi avec sa zone tactile ;
   les autres cibles sous 44 px que tu juges devoir grandir ; et la manière dont la classe
   « Vue téléphone » doit se composer avec les `@media` existants sans les voir doubler
   d'effet. Termine par un tableau « règle → tokens utilisés ».
2. **`scada-opus-5.5/_verify/spec-acceptation.md`** — les critères d'acceptation
   **mesurables**, en français, sous forme de liste numérotée : ce qu'on mesure, à quelle
   taille d'écran, et le seuil. Distingue ce qui doit être vrai **par largeur** (≤ 900 px)
   et ce qui doit être vrai **en mode forcé** (classe posée à 1440 px). Inclut au moins :
   zéro débordement horizontal ; la barre d'onglets visible et ses rubriques ; la colonne
   latérale masquée ; l'interrupteur à sa taille cible et sa zone tactile ; la grille de
   la vue d'ensemble à une colonne ; zéro erreur console ; et l'invariance du bureau
   (le rendu à 1440 px, 1280 px et 1600 px doit être identique avant/après).
3. **Une section « ce que je n'ai pas tranché »** à la fin de la spécification, plus une
   **critique de mes trois constats** : dis si mes lectures te paraissent justes, et
   signale ce que tu vois dans le code qui casserait sur un téléphone et que ma mesure
   n'a pas vu (par exemple une cible tactile imbriquée, un débordement vertical, une
   hauteur dépendante de la fenêtre, un défilement latéral d'un tableau).

## Contraintes

- **Tout en français** : commentaires, titres, identifiants, libellés.
- Pas de nouvelle dépendance, pas de build, pas de CDN, pas de framework.
- Ne modifie **pas** `hakko-dashboard.html` : tu écris seulement les deux fichiers de
  spécification. L'application du correctif et la mesure me reviennent.
- Si un besoin de ta spécification te semble impossible sans toucher au style de base,
  dis-le dans « ce que je n'ai pas tranché » plutôt que de proposer une entorse.
