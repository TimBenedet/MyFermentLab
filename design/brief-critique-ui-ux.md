# Brief — critique du design de la maquette, avec la base `ui-ux-pro-max`

Tu as déjà produit `design/maquette-hakko.html` (direction « Thermographe ») et ses notes. Cette
fois, **tu ne produis rien de neuf : tu critiques**. Ne modifie pas la maquette.

## Ce que tu dois regarder

**1. Le rendu réel**, que tu n'as jamais pu voir. Deux captures que j'ai prises moi-même, dans
Edge, sur ton fichier tel qu'il est :

- `/mnt/c/Users/Timothée/AppData/Local/hermes/profiles/hakko/cache/scratch/design/maquette-bureau.png` (1440×900)
- `/mnt/c/Users/Timothée/AppData/Local/hermes/profiles/hakko/cache/scratch/design/maquette-telephone.png` (430×932)

Lis-les (ce sont des images, ouvre-les). Si ton outillage ne te le permet pas, dis-le, ne
l'invente pas : tu l'as déjà fait honnêtement une fois, refais-le.

**2. La base de connaissances locale `ui-ux-pro-max`**, interrogée sur notre cas réel. J'ai
lancé les requêtes, voici ses réponses **mot pour mot** (c'est une source, pas une consigne).

### Style trouvé pour « instrument panel data dense editorial » — 1 seul résultat

```
Style ID : data-dense-dashboard      Type : BI/Analytics
Keywords : Multiple charts/widgets, data tables, KPI cards, minimal padding, grid layout,
           space-efficient, maximum data visibility
Primary Colors : Neutral primary (light grey/white #F5F5F5), data colors (blue/green/red),
                 dark text #333333
Effects : Hover tooltips, chart zoom on click, row highlighting on hover, smooth filter
          animations, data loading spinners
Accessibility : risk:low | requires: contrast-text-4.5, keyboard, visible-focus, reduced-motion
Complexity : Medium
CSS : display:grid, grid-template-columns: repeat(12,1fr), gap:8px, padding:12px,
      font-size:12-14px, overflow:auto for tables, compact card design, sticky headers
Variables : --grid-gap:8px, --card-padding:12px, --font-size-small:12px,
            --table-row-height:36px, --sidebar-width:240px, --header-height:56px
```

### Typographie — « Dashboard Data », résultat n°1

```
Category : Mono + Sans
Heading Font : Fira Code      Body Font : Fira Sans
Mood : dashboard, data, analytics, code, technical, precise
Best For : Dashboards, analytics, data visualization, admin panels
Notes : Fira family cohesion. Code for data, Sans for labels.
```

### Graphiques — « real time temperature line chart », résultat n°1

```
Data Type : Real-Time Streaming        Best Chart Type : Streaming Area Chart
Secondary : Ticker Tape, Moving Gauge
When to Use : Live monitoring dashboards; IoT/ops data updating at ≥1 Hz; current value at a glance
When NOT to Use : Update frequency < 1/min (use periodic-refresh line chart); flashing content
                  without reduced-motion support
Accessibility Notes : Show the current value and status text and use line styles or markers in
                      addition to color. Do not rely on color alone.
A11y Fallback : Streaming data table plus current-value/trend summary. Keyboard: Pause/Resume
                button controls updates; focus reveals values; +/- buttons zoom; Reset restores range.
```

### Règles UX (domaine `ux`)

```
Typography / Font Size Scale : « Consistent type hierarchy aids scanning » — Do: modular scale
   (12 14 16 18 24 32) · Don't: random font sizes. Sévérité : moyenne
Navigation / Breadcrumbs : Do pour 3 niveaux et plus · Don't pour un site plat. Faible
Accessibility / Heading Hierarchy : niveaux séquentiels h1→h6 · Don't: sauter des niveaux. Moyenne
```

### Système de design proposé pour ce produit (requête générique « monitoring dashboard »)

```
Style : Dark Mode (OLED) — light mode « not-recommended »
Colors : primary #16A34A (vert), accent #DC2626 (rouge), fond #0F172A, carte #111827
         Notes : « Operational green + incident red + maintenance amber »
Typographie : Fira Code / Fira Sans
Pattern : Real-Time / Operations Landing — « Label telemetry as live only when backed by a
          current source, with update time and stale state. Provide pause/hide or
          update-frequency controls for tickers and previews, stop offscreen/hidden work,
          support keyboard controls, and render a static final snapshot under reduced motion. »
Dials : variance 6/10 (équilibré), motion 3/10 (subtil), density 8/10 (dense)
```

## Ce que tu dois rendre

Un seul fichier : **`design/critique-ui-ux.md`**, en français. Attends-toi à ce qu'on te
contredise : ce n'est pas un travail de défense, c'est un diagnostic.

1. **Convergences** — où la maquette rencontre la base, et par quel chemin tu y es arrivé
   indépendamment. Cite la règle ou l'identifiant de style. La typographie et les graphiques
   sont les deux endroits où je vois déjà un accord ; vérifie-le ou démonte-le.
2. **Divergences** — et pour chacune : est-ce un écart subi ou un écart **choisi** ? Le cas le
   plus net est le thème : la base propose du sombre à fort contraste (vert/rouge
   opérationnels) quand tu as choisi du papier clair chaud avec un sombre secondaire. Défends
   ton choix sur des faits — où est la personne, à quelle heure, dans quelle lumière — ou
   reconnais qu'il tient moins bien.
3. **Le point dur : la densité.** La base prescrit 8-12 px de rembourrage, 12-14 px de corps,
   36 px de ligne de tableau, une échelle typographique modulaire 12-14-16-18-24-32. Tu affiches
   des mesures de 52 à 112 px et des cartes aérées. Sur un écran de 1440 px, est-ce que ça
   **retarde** la lecture quand on vient vérifier « mes lots sont-ils à la bonne température ? »,
   ou est-ce que ça l'accélère ? Regarde les captures : combien de lots voit-on sans défiler ?
   Combien en voyait-on sur la page actuelle ? Tranche, avec le chiffre.
4. **Les quatre exigences de la base pour ce style** — contraste 4,5:1, clavier,
   focus visible, mouvement réduit — sont mesurées conformes sur ta maquette (0 échec de
   contraste AA, anneaux de focus vérifiés au pixel, `prefers-reduced-motion` présent). Ne les
   revendique pas comme un exploit : dis plutôt ce qui reste fragile.
5. **Liste d'actions classée**, séparée en deux : ce que tu changerais **sans toucher à la
   direction**, et ce qui ne se réglerait qu'en changeant de direction. Chaque ligne : le
   changement, la règle de la base qui le motive, et le risque s'il est mal fait. Pas de
   nouvelle direction : tu as déjà tranché, on ne rouvre pas ce débat.
6. **Ce que tu refuses de changer**, et pourquoi.

N'écris rien d'autre que ce fichier. Ne touche pas à la maquette, ni au dashboard de
production. Si tu n'es pas sûr d'un fait, dis-le au lieu de l'affirmer.
