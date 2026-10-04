# Brief — deuxième maquette, habillée par la base `ui-ux-pro-max`

Tu as déjà produit `design/maquette-hakko.html` (direction « Thermographe », papier chaud) et tu
en as écrit la critique. La demande de l'utilisateur est maintenant explicite et différente :

> **Montre-moi le dashboard avec ui-ux-pro-max.**

Il veut **voir** à quoi ressemble la même application si l'on suit la base, pour la comparer à ta
direction. Ce n'est pas un jugement sur ton travail : c'est une seconde mise en forme, demandée.

## Livrables

| Fichier | Contenu |
|---|---|
| `design/maquette-uiux.html` | la même application, habillée par la base, autonome |
| `design/maquette-uiux-notes.md` | ce que la base impose, ce que tu as dû interpréter, ce qu'elle ne couvre pas |

## Méthode imposée : re-habiller, pas réécrire

**Copie `design/maquette-hakko.html`** et change son habillage. Le contenu, les données, les
routes, les calculs et le JavaScript restent. Ce qui doit disparaître, c'est l'identité
« Thermographe » : papier chaud, grille millimétrée, grain, lueur d'étuve, libellés en petites
capitales espacées, grandes lectures de 52 à 112 px, cartes aérées. Rien de tout cela ne doit
survivre si la base ne le prescrit pas.

Le système complet proposé par la base est consigné dans **`design/ui-ux-pro-max-systeme.md`**
(je l'ai fait écrire pour toi). Lis-le. L'essentiel :

- **Style** : `Dark Mode (OLED)` — clair « *not-recommended* ». Sombre profond, contraste élevé.
- **Couleurs** : primaire `#16A34A` (vert opérationnel), accent `#DC2626` (incident), fond
  `#0F172A`, carte `#111827`, bordure `#334155`, texte `#F8FAFC`, texte atténué `#CBD5E1`.
  Sémantique annoncée : « *operational green + incident red + maintenance amber* ».
- **Typographie** : **Fira Code** (données, titres) + **Fira Sans** (texte) — la paire canonique
  « Dashboard Data », à charger par Google Fonts avec `display=swap` et un repli système complet.
- **Densité 8/10**, style `data-dense-dashboard` : grille 12 colonnes, `gap:8px`,
  `padding:12px`, corps **12 à 14 px**, `--table-row-height:36px`, en-têtes de tableau collants,
  cartes compactes, `--sidebar-width:240px`, `--header-height:56px`, échelle typographique
  modulaire **12 · 14 · 16 · 18 · 24 · 32**.
- **Graphiques** : la base prescrit le « *periodic-refresh line chart* » quand la grandeur change
  moins d'une fois par minute — c'est notre cas. Elle exige : valeur courante et texte d'état,
  styles de trait ou marqueurs **en plus** de la couleur, et pour l'accessibilité un
  « *data table plus current-value/trend summary* », avec Pause/Reprendre, zoom +/− et Reset.
- **Pattern Real-Time** : « *Label telemetry as live only when backed by a current source, with
  update time and stale state. Provide pause/hide or update-frequency controls. Stop
  offscreen/hidden work. Render a static final snapshot under reduced motion.* »
- **Dials** : variance 6/10, mouvement 3/10 (subtil), densité 8/10.

Applique-les **littéralement**, y compris là où ton jugement de designer te ferait dire non.
C'est le but : montrer la base telle qu'elle est. Quand une prescription te paraît fausse ou
inapplicable, applique-la quand même et écris-le dans les notes — sauf si elle casse
l'accessibilité, auquel cas tu gardes l'accessibilité et tu l'expliques.

## Ce que tu appliques aussi, parce que la base le prescrit elle-même

1. **L'âge et la péremption des mesures.** Chaque mesure affichée en grand porte son âge, et
   au-delà d'un seuil l'affichage passe en état « périmé » (grisé + forme, pas seulement la
   couleur). « En direct » ne s'affiche que quand une source répond réellement. C'était ta
   propre action n° 1 : la base la justifie aussi.
2. **Le tableau de données repliable** sous chaque courbe, agrégé pour ne pas noyer le lecteur
   d'écran, avec un résumé texte (minimum, maximum, dernière valeur).
3. **Rien ne tourne quand l'onglet est masqué** (`visibilitychange`), avec rafraîchissement
   immédiat au retour.
4. **Tableaux du bureau** : lignes de 36 px, en-têtes collants, `scroll-padding` cohérent.
5. **Échelle typographique** réduite aux six valeurs de la base, plus **au plus une** taille de
   lecture hors échelle, si la base l'exige par ailleurs.

## Ce qui reste non négociable

- **Un seul fichier HTML**, autonome, ouvrable par double-clic. Aucune compilation, aucun paquet,
  aucune bibliothèque : HTML, CSS et JavaScript natifs. Seule ressource externe : Google Fonts.
- **Les quatre exigences de la base** : contraste ≥ 4,5:1 pour le texte et ≥ 3:1 pour
  l'interface, navigation au clavier complète, anneaux de focus visibles partout (champs de
  saisie compris), `prefers-reduced-motion` respecté.
- **Téléphone** : cibles de 44 px, champs de 16 px, `env(safe-area-inset-*)`, barre d'onglets
  basse sous 900 px, aucun débordement horizontal à 390 px.
- **Mêmes données, mêmes valeurs, mêmes intitulés, même langue** (français, y compris les
  commentaires de code) que la première maquette.
- **Ne modifie aucun autre fichier.** Ni la première maquette, ni le dashboard de production,
  ni les notes, ni la revue. Tu écris uniquement les deux livrables ci-dessus.

## Dans les notes

- Ce que la base impose sans ambiguïté, et ce que tu as dû interpréter.
- Ce qu'elle prescrit et que tu as appliqué **contre ton propre jugement** (§ 2.2 de ta
  critique : le vert primaire face au vert d'état — comment tu l'as résolu).
- Lesquelles de tes dix actions de critique cette variante corrige par construction, et
  lesquelles restent ouvertes.
- Ce que tu n'as pas pu vérifier, comme la fois précédente. Les captures sont maintenant dans le
  dépôt : `design/captures/maquette-bureau.png`, `maquette-telephone.png`, `maquette-390.png`,
  `actuel-bureau.png`, `actuel-telephone.png`. Essaie de les lire ; si l'accès t'est encore
  refusé, dis-le, ne décris rien que tu n'aies vu.
