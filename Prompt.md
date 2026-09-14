# Mission

Monitoring de fermentation, **données entièrement simulées côté client**. Pas de
backend, pas de base de données, pas de routing : `npm run dev` doit suffire à tout voir.

**Seule dépendance externe actée : Home Assistant**, en lecture et en commande, via la
vue « Devices » et un proxy du serveur de dev. Le jeton est injecté **côté serveur** et
n'atteint jamais le navigateur.

Ce fichier décrit l'**état actuel** du projet et prime en cas de divergence sur tout
autre document. Les règles visuelles sont dans `THEME.md` ; le résumé opérationnel lu à
chaque requête est `.github/copilot-instructions.md`.

---

# 1. Stack

- **Vite** + **React** + **TypeScript** + **Tailwind CSS v4** + **Recharts**. Rien d'autre.
- Tailwind v4 avec le plugin `@tailwindcss/vite` : **pas de `tailwind.config.js`,
  pas de `postcss.config.js`**, le thème se déclare dans `src/index.css` via `@theme`.
- `npm run build` = `tsc --noEmit && vite build` doit passer **sans erreur**.
- **Aucun `any`**, aucun `@ts-ignore`, aucun `@ts-expect-error`. Tout en `strict`,
  plus `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`,
  `verbatimModuleSyntax`, `isolatedModules`.
- Tu n'écris **rien en dehors du dossier courant**, tu n'installes **rien globalement**.
- Interface en **français**, nombres au format `fr-FR` (virgule décimale).
- **Home Assistant** : `vite.config.ts` expose `/ha` → `HASS_URL` en injectant
  `Authorization: Bearer $HASS_TOKEN`. `HASS_URL` et `HASS_TOKEN` vivent dans
  `.env.local` (gitignoré). La clé n'existe que côté serveur de dev.

# 2. Arborescence

```
index.html                 lang="fr", <div id="root">, color-scheme dark
package.json               scripts dev / build / preview, "type": "module"
tsconfig.json              ES2022, bundler, react-jsx, strict, noEmit
vite.config.ts             plugins [react(), tailwindcss()], server.port 5173,
                           proxy /ha → HASS_URL, jeton injecté côté serveur
.env.local                 HASS_URL, HASS_TOKEN — gitignoré, jamais commité
.gitignore                 node_modules, dist, *.local, .env*
scripts/demo.ts            démonstration du moteur hors navigateur
src/
  main.tsx                 createRoot + StrictMode, importe index.css
  App.tsx                  coque, barre latérale, bascule Accueil / Produit / Devices
  index.css                @import "tailwindcss", @theme (couleurs + animation), base
  types.ts                 tout le modèle de données
  config/fermentations.ts  les 5 ferments, GRAVITY_KINDS, tracksGravity()
  lib/random.ts            mulberry32, gaussian (Box-Muller), clamp
  lib/format.ts            formatage fr-FR (mesures, écarts, pourcentages, horloge)
  lib/status.ts            seuils, classement d'état, styles de statut
  lib/reading.ts           assess() : écarts, états, densité, atténuation
  lib/regulation.ts        état de la boucle : chauffe / refroidissement / repos
  lib/homeassistant.ts     entités HA, familles suivies, appel de service
  simulation/engine.ts     moteur de simulation, historique 24 h
  hooks/
    useFermentationFeed.ts      moteur sur setInterval + commande de consigne
    useHomeAssistantEntities.ts lecture des entités, rafraîchissement 30 s
  components/
    FermentationCard.tsx   carte du tableau de bord
    FermentationDetail.tsx vue pleine page d'un ferment
    StatusDot.tsx          pastille d'état
    MetricRow.tsx          ligne label/valeur
    MetricChart.tsx        graphe 24 h générique
    SetpointControl.tsx    commande de consigne (champ, +/−, Valider)
    RegulationStatus.tsx   état de la boucle de régulation
    DevicesView.tsx        vue Devices (Home Assistant)
    MetricIcon.tsx         icônes température / humidité / prise
    TankVessel.tsx         illustration cuve (liquides)
    KojiTray.tsx           illustration étuve à koji
    MisoCrock.tsx          illustration pot de miso
    VesselIllustration.tsx aiguillage selon le type de contenant
```

# 3. Modèle de données (`src/types.ts`)

```ts
export type FermentId = 'ipa' | 'hydromel' | 'koji' | 'miso' | 'garum';
export type StatusLevel = 'ok' | 'warn' | 'alarm';

export interface ChannelDynamics {
  readonly noise: number;          // écart type du bruit blanc, par racine de seconde
  readonly cycleAmplitude: number; // amplitude du cycle lent de régulation
  readonly burstScale: number;     // amplitude des perturbations ponctuelles
}
export interface Setpoints { readonly temperature: number; readonly humidity: number | null; }
export interface Dynamics { readonly temperature: ChannelDynamics; readonly humidity: ChannelDynamics | null; }
export interface GravitySetpoint { readonly original: number; readonly final: number; readonly elapsedHours: number; }

export interface TankVesselConfig  { readonly kind: 'tank';  readonly label: string; readonly liquid: string; }
export interface KojiVesselConfig  { readonly kind: 'koji';  readonly label: string; readonly substrate: string; readonly spore: string; }
export interface CrockVesselConfig { readonly kind: 'crock'; readonly label: string; readonly paste: readonly string[]; }
export type VesselConfig = TankVesselConfig | KojiVesselConfig | CrockVesselConfig;

export interface FermentConfig {
  readonly id: FermentId; readonly name: string; readonly context: string;
  readonly setpoints: Setpoints; readonly dynamics: Dynamics;
  readonly gravity: GravitySetpoint | null; readonly vessel: VesselConfig | null;
  readonly seed: number;           // graine du générateur, historique reproductible
}
export interface Sample { readonly t: number; readonly temperature: number; readonly humidity: number | null; readonly density: number | null; }
export interface FermentReading { readonly config: FermentConfig; readonly current: Sample; readonly history: readonly Sample[]; }
export interface Feed { readonly fermentations: Record<FermentId, FermentReading>; readonly timestamp: number; }
```

# 4. Les 5 ferments (`src/config/fermentations.ts`)

| id | nom | contexte | T° cible | %HR cible | dynamique T° (noise, cycle, burst) | dynamique HR | densité (OG→FG, heures) | contenant |
|---|---|---|---|---|---|---|---|---|
| ipa | Bière IPA | Cuve 1 · fermentation principale | 19,5 | — | 0,0028 / 0,15 / 1,7 | — | 1,060 → 1,012, 62 h | `tank` « Cuve 1 · 250 L », `#d9942a` |
| hydromel | Hydromel | Cuve 2 · fermentation lente | 18 | — | 0,0032 / 0,17 / 2,0 | — | 1,108 → 1,004, 90 h | `tank` « Cuve 2 · 60 L », `#e6c65c` |
| koji | Koji | Étuve · culture de surface | 30 | 75 | 0,0036 / 0,19 / 2,4 | 0,05 / 2,6 / 9 | — | `koji` « Étuve · bac de 40 L », substrat `#e9dfc4`, spores `#c9d29b` |
| miso | Miso | Cellier · pot de 30 kg | 30 | 72 | 0,0035 / 0,22 / 2,2 | 0,05 / 2,4 / 8 | — | `crock` « Pot 3 · pâte de soja », pâte `['#7d4a22', '#a9713c', '#c98f4a']` |
| garum | Garum | Amphores · saumure de poisson | 26 | 62 | 0,0034 / 0,24 / 2,3 | 0,055 / 2,8 / 9 | — | `tank` « Cuve 4 · 120 L », `#8a6a3a` |

Graines à utiliser, dans cet ordre : `0x1a2b3c`, `0x2b3c4d`, `0x3c4d5e`, `0x5e6f70`, `0x6f7081`.

Chaque ferment sans humidité doit avoir `humidity: null` dans `setpoints` **et** dans `dynamics`.

# 5. Moteur de simulation (`src/simulation/engine.ts`)

Constantes exactes :

```ts
export const TICK_MS = 2_000;            // rafraîchissement de l'affichage
export const HISTORY_STEP_MS = 30_000;   // pas d'archivage
export const HISTORY_WINDOW_MS = 86_400_000;
const REVERSION_TAU_SEC = 780;           // rappel vers la consigne
const DRIFT_PERIOD_SEC = 3_420;          // cycle lent ~57 min
const RIPPLE_PERIOD_SEC = 1_680;         // ondulation ~28 min
const BURST_HALF_LIFE_SEC = 420;         // relaxation des perturbations
const BURST_MIN_GAP_MS = 30 * 60_000;    // perturbation toutes les 30 à 95 min
const BURST_MAX_GAP_MS = 95 * 60_000;
const MAX_SUB_STEP_SEC = 2;              // subdivision si l'onglet a été inactif
const INITIAL_SPREAD_TEMPERATURE = 0.35;
const INITIAL_SPREAD_HUMIDITY = 2.5;
const GRAVITY_TAU_HOURS = 46;
const GRAVITY_DRIFT = 0.0008;
const GRAVITY_RIPPLE = 0.0005;
```

**Canal de mesure** (température, humidité) — processus d'Ornstein-Uhlenbeck :

```
driftPhase  += 2π·dt / 3420      (modulo 2π)
ripplePhase += 2π·dt / 1680      (modulo 2π)
cycle = cycleAmplitude · (0,78·sin(driftPhase) + 0,22·sin(ripplePhase))

si t ≥ nextBurstAt :
    burst = ± burstScale · (0,35 + 0,75·random)
    nextBurstAt = t + 30 min + random·(65 min)
burst *= exp(-ln2·dt / 420)

cibleEffective = consigne + cycle + burst
value += (cibleEffective - value)·dt / 780
       + clamp(gaussian(random), -3, 3)·noise·√dt
```

**Densité** — fonction **pure du temps** (aucun état, donc jamais de dérive entre
l'historique archivé et la valeur live) :

```
pitchedAt = nowMs - elapsedHours·3 600 000
h = (t - pitchedAt) / 3 600 000
densité = FG + (OG - FG)·exp(-h / 46)
        + 0,0008·sin(2π·(t/3 600 000)/11 + φ)
        + 0,0005·sin(2π·(t/3 600 000)/3,5 + 2,7φ)
avec φ = ((seed mod 997)/997)·2π
```

**Cycle de vie**

- Au démarrage de chaque ferment : générer **24 h d'historique** en intégrant le canal
  pas de 30 s (le préchauffage part de `now - 24 h`), valeur initiale = consigne ± 0,35 °C
  (2,5 %HR), phases tirées au hasard via `mulberry32(seed)`. La densité est calculée
  par la formule ci-dessus à chaque échantillon.
- `advance(nowMs)` : `dt = max((nowMs - lastAdvanceAt)/1000, 0)`, subdivisé en pas ≤ 2 s
  (`steps = max(1, ceil(dt/2))`) pour absorber un onglet resté inactif.
- Archivage : on pousse l'échantillon courant **toutes les 30 s** dans `stored`, puis on
  purge tout ce qui sort de la fenêtre de 24 h (`splice` après recherche de l'index).
- `snapshot()` renvoie un `Feed` où `history` est **toujours un nouveau tableau**
  (`[...stored]`, plus l'échantillon courant s'il n'y est pas déjà) — sinon React
  mémoïse à tort les graphiques.
- Toute la mutation d'état est interne à la classe `FermentationEngine` ; React ne voit
  que des objets immuables.

**Commande de consigne** — `FermentationEngine.setTemperatureSetpoint(id, value)` :
- remet à jour **le canal de mesure et la config** du ferment. Sans la config, `assess()`
  continuerait de calculer l'écart et l'état contre l'ancienne cible : la pastille
  resterait verte sur une cuve à 3 °C de sa nouvelle consigne.
- La config est **remplacée**, jamais mutée (`{ ...config, setpoints: { ... } }`) : React
  ne reçoit que de l'immuable.
- La valeur mesurée ne saute pas : le rappel vers la cible (constante de temps 780 s) l'y
  amène progressivement.
- `useFermentationFeed` renvoie `Feed` **plus** `setTemperatureSetpoint`, et déclenche un
  `snapshot()` immédiat — sinon la consigne validée ne se verrait qu'au tick suivant,
  jusqu'à 2 s plus tard.

# 6. États, seuils, formats

`src/lib/status.ts`

```ts
export const NOMINAL_BAND = 0.2;            // °C
export const ALARM_THRESHOLD = 1;           // °C
export const HUMIDITY_NOMINAL_BAND = 2;     // points de %
export const HUMIDITY_ALARM_THRESHOLD = 5;  // points de %

export function classify(delta: number, band: number, alarm: number): StatusLevel {
  const m = Math.abs(delta);
  if (m <= band) return 'ok';
  if (m <= alarm) return 'warn';
  return 'alarm';
}
```

`STATUS_STYLES: Record<StatusLevel, { label; description; dotClass; textClass; hexColor }>`

| état | libellé | dotClass | textClass | hexColor |
|---|---|---|---|---|
| ok | Nominal | `bg-emerald-500` | `text-emerald-400` | `#10b981` |
| warn | Dérive | `bg-amber-500` | `text-amber-400` | `#f59e0b` |
| alarm | Alarme | `bg-red-500` | `text-red-400` | `#ef4444` |

Plus `NEUTRAL_TEXT_CLASS = 'text-zinc-300'`, `toneClassFor(status)` (neutre si `ok`),
`statusTextClass(status)` (couleur pleine, vert compris).
Les classes Tailwind sont **écrites en toutes lettres** dans la table : aucune classe
construite par concaténation, sinon Tailwind ne les génère pas.

`src/lib/reading.ts` : `assess(reading)` renvoie `{ temperatureDelta, temperatureStatus,
humidityDelta, humidityStatus, density, attenuation }` avec
`attenuation = (OG - densité) / (OG - FG) · 100`.

`src/lib/format.ts` : `Intl.NumberFormat('fr-FR')` et `Intl.DateTimeFormat('fr-FR')`.
- `formatMeasure(valeur, 0 | 1 | 2 | 3)` (défaut 1)
- `formatPercent(valeur, 0 | 1 | 2 | 3)` (défaut 1) : espace insécable étroite avant `%`
- `formatSigned(valeur, decimals)` : signe `+` ou `−` (U+2212), jamais `-0,0`
- `formatClock(t)` → `HH:MM`, `formatClockSeconds(t)` → `HH:MM:SS`

`src/lib/regulation.ts` : état de la boucle, déduit de l'écart à la consigne.

- `REGULATION_DEADBAND = 0.1` (demi-bande morte), `RATE_WINDOW_MS = 15 min`.
- `classifyRegulation(delta)` → `'heating' | 'cooling' | 'holding'`.
- `temperatureRate(history, now)` → variation en **°C/h sur 15 min**, `null` si
  l'historique est trop court. Sur une heure pleine la mesure s'annulerait : le cycle de
  régulation dure 57 min.
- `REGULATION_STYLES` porte les classes littérales des trois pastilles.

# 7. Composants

**`StatusDot`** — pastille ronde colorée + libellé (`showLabel`, défaut `true`, sinon texte
en `sr-only`), `title` = description de l'état. Fond teinté à 10 % et anneau à 30 %,
jamais un aplat saturé.

**`MetricRow`** — ligne « label à gauche / valeur à droite ». Rend des **`<span>`** (et
non des `<div>`) car elle est utilisée à l'intérieur d'un `<button>` : HTML valide.
Libellé `text-[11px] text-zinc-400`, valeur `text-[12px] font-medium tabular-nums`,
rythme `py-0.5`, aucune bordure.

**`FermentationCard`** — un `<button>` contenant :
- en-tête : nom puis, **sur sa propre ligne**, le contexte du contenant — coincé à côté
de la pastille d'état, « Cuve 1 · fermentation principale » se tronquait — et la pastille
+ le chevron `›` à droite ;
- **température en gros** : `text-2xl font-medium leading-none tabular-nums text-zinc-100`,
**sans mono** et **sans couleur d'état** ; écart signé à droite en `text-[12px] text-zinc-400` ;
- des `MetricRow` : Humidité (ou « non instrumentée », en `font-normal text-zinc-500`),
Écart HR, Densité, Atténuation. **Pas de ligne « Consigne » ni « Écart »** : la cible est
soit dans les relevés, soit dans la commande, et l'écart est déjà à côté du chiffre.
- `aria-label` récapitulatif (« Bière IPA : 19,6 degrés, consigne 19,5 degrés, écart
+0,07 degré, état nominal »).
- Grille : `grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5` — les cinq
ferments tiennent sur une ligne dès 1280 px.

**`MetricChart`** — graphe générique d'une grandeur sur 24 h. Props : `title`, `unit`,
`metric` (`'temperature' | 'humidity' | 'density'`), `data`, `target`, `targetLabel`,
`color`, `decimals`, `minPadding`, `bandHalfWidth`, `bandColor`, `windowEnd`, `footnote`.
- `figure` en `flex min-h-0 flex-1 flex-col` ; zone de tracé `min-h-[120px] flex-1`
  (plancher pour que Recharts ne s'écrase pas à zéro).
- Sous-échantillonnage à **320 points** par pas constant, en conservant toujours le
  dernier point.
- `AreaChart` + `Area` `type="monotone"`, `stroke={color}`, `strokeWidth 1.6`,
  `fill={color}` `fillOpacity 0.12`, `dot={false}`, `isAnimationActive={false}`.
- `ReferenceArea` de la bande nominale (`target ± bandHalfWidth`, `fill={bandColor}`,
  `fillOpacity 0.14`) — c'est elle qui rend la zone verte/ambre/rouge lisible.
- `ReferenceLine` de la consigne en pointillés `#5f646c` (`strokeDasharray="4 4"`).
- `XAxis` `dataKey="t"` `type="number"` `scale="time"`, **domaine fixe**
  `[windowEnd - 86 400 000, windowEnd]` (le graphe défile, il ne zoome pas),
  `tickFormatter` = `formatClock`, `minTickGap 56`.
- `YAxis` `width={52}`, `tickFormatter` = `formatMeasure(valeur, decimals)`. Le domaine
  est calculé sur les données **et** la cible (marge `max((max-min)·0,18, minPadding)`)
  puis **imposé** à Recharts, avec des `ticks` à pas rond (`niceTicks`). Sans cela Recharts
  élargit le domaine pour caser ses « nice values » : sur une consigne à 19,5 °C l'axe
  partait de 19,0 et la courbe se tassait dans le tiers central du cadre.
- `Tooltip` avec un `content` maison : date `HH:MM` puis valeur + unité, cadre
  `border-anthracite-700 bg-anthracite-850`.
- Pied de figure en `text-[10px] text-zinc-600` (mini/maxi 24 h, écart actuel,
  atténuation…).

**`FermentationDetail`** — vue **pleine page** d'un ferment. La colonne de gauche porte
tout le ferment, la droite ne porte que les graphes.

- En-tête sur **une seule ligne** : bouton `← Ferments` (`title="Revenir à la vue
d'ensemble (Échap)"`), nom en `h1`, pastille d'état, puis contexte + « 24 h glissantes ·
acquisition HH:MM:SS ».
- Colonne de gauche (`lg:w-56`, `justify-between`), dans l'ordre : illustration du
contenant (boîte au rapport **160/250**, hauteur `h-40`), libellé, chiffre de tête et
écart, `SetpointControl`, relevés, `RegulationStatus`, synthèse « Sur 24 h ».
- La synthèse est un **tableau à 3 lignes** (`Sur 24 h` / `Moyenne` / `Amplitude` en
en-tête, puis une ligne par canal) : elle portait 6 lignes de `MetricRow`, 104 px contre
63, et la colonne n'a que 566 px à 1024×640. Elle porte moyenne et amplitude, jamais le
min/max, qui reste dans la note sous chaque graphe — sinon les deux se répètent.
- Colonne de droite : les graphes empilés, chacun en `flex-1 min-h-0`.
- Si le ferment n'a pas de contenant : pas de colonne, le tout passe en bandeau.
- **Objectif** : le bas des deux colonnes coïncide. La rangée remplit la hauteur
  disponible et la colonne de gauche s'étire à la même hauteur.

**`SetpointControl`** — champ, boutons `+` / `−`, bouton `Valider`.

- Pas de **0,5 °C**, bornes **4 à 45 °C**. La bande nominale fait 0,2 °C : 1 °C est trop
grossier, 0,1 demanderait 25 clics.
- La saisie est un **brouillon** : rien ne part au moteur avant `Valider`. Entrée valide,
Échap annule.
- **Échap doit faire `stopPropagation`** : `App` l'écoute sur `window` pour fermer la vue
produit ; sans cela, annuler la saisie fermait aussi la page.
- `rétablir` apparaît dès que la consigne diffère de celle de `src/config/fermentations.ts`.
- La consigne vit **en mémoire** : un rechargement repart des valeurs de la config.

**`RegulationStatus`** — pastille pleine largeur (chauffe **rouge**, refroidissement bleu
température, à consigne émeraude) et vitesse de variation. Le code couleur est celui du
**geste**, pas de l'état du ferment : une résistance qui chauffe est rouge même quand la
cuve est nominale.

**`DevicesView`** — vue Home Assistant : trois familles repliables (sondes de température,
humidité, prises), avec recherche et compteur, et pour chaque prise une bascule
`role="switch"`. L'état optimiste est borné par `OVERRIDE_TTL_MS = 6 s` : sans ce délai,
une bascule acceptée par l'API mais sans effet réel resterait allumée indéfiniment.

**`VesselIllustration`** — aiguillage `if (vessel.kind === 'tank') … else if ('koji') …
else …` vers `TankVessel`, `KojiTray`, `MisoCrock`. L'union discriminée garantit que
tout nouveau type sans illustration ne compile pas.

# 8. Illustrations SVG — style imposé

**Règles communes** : `viewBox="0 0 160 250"`, `role="img"` + `aria-label`,
`className="h-full w-full"` (c'est le parent qui pilote la hauteur). **Aplats uniquement :
aucun dégradé, aucune ombre, aucun effet de volume.** Contour unique `strokeWidth 2`,
couleur `#3a3f47`. Un seul contenant, un aplat de produit, des particules animées.
Rien d'autre.

- **`TankVessel`** (bière, hydromel, garum) : un `rect` arrondi (`x=26 y=16 w=108 h=218
  rx=14`) + le liquide en aplat (`rect` à partir de `y=100`, rogné par le contenant) +
  **9 bulles** blanches (`fillOpacity 0.45`) qui remontent, rognées au liquide.
- **`KojiTray`** : le même contenant ; le lit de substrat est **un seul `path`** dont le
  bord supérieur est **dentelé** (17 points, écarts de 0, ±1, ±2, ±3) pour lire comme un
  solide et non un liquide ; par-dessus, une **croûte de sporulation** (bande plate de
  13 px qui suit exactement la dentelure, générée en parcourant les points à l'aller puis
  au retour décalé) dans la teinte de spores ; puis **16 spores** dans cette même teinte
  (`fillOpacity 0.7`), rayons 1,2 à 2,9, décalées sur 10 à 16 s.
- **`MisoCrock`** : un **pot en verre** — couvercle, col, épaule en trapèze, corps arrondi
  — tracé en `#4a5058` avec un **reflet vertical** blanc à 6 %. À l'intérieur, **trois
  monticules** de pâte superposés (du plus sombre au plus clair). Chaque butte est un
  `path` construit en passant des courbes quadratiques `Q` par les points de crête
  (algorithme des points milieux), base au fond du pot.
  - Leurs bases **débordent des parois** (le `clipPath` recoupe) : sinon la pâte s'arrête
    à x=28 et x=132 et laisse deux coins de fond de pot à nu, ce qui se lit comme une
    pâte qui ne remplit pas le verre.
  - Chaque monticule a un **niveau de bord** (`edge`, 0 = fond du pot, 1 = hauteur de la
    crête). Proche de 1, la surface devient presque de niveau : **de la pâte tassée,
    pas un tas**. Un pot rempli a une surface plane, pas un dôme.
  - Puis **34 grains** plats (cercles de rayon 1,2 à 2,8) répartis sur la **largeur
    intérieure du pot** (26 → 134) et non sur celle du monticule, qui déborde désormais
    des parois : sinon une partie naîtrait hors du verre. **Aucune animation** : une pâte
    solide ne fait pas de bulles.

# 9. Mise en page — contrainte forte : rien ne défile

- Coque : `flex min-h-dvh flex-col … lg:h-dvh lg:overflow-hidden`, fond
  `bg-anthracite-950`, padding `px-3 py-3 sm:px-6`.
- Conteneur interne : `mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-2.5`.
- **Barre latérale** `lg:w-52` : titre, navigation `Accueil` / `Devices`, trois compteurs
  (nominaux / dérives / alarmes) calculés depuis les relevés, horloge d'acquisition en
  pied. Sous `lg` elle passe en bandeau horizontal.
- Accueil : `grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`. À 1024 px
  la grille reste à 3 colonnes : en 5, la carte tomberait à 145 px et « Atténuation
  74,6 % » ne tiendrait plus.
- Clic sur une carte → la grille disparaît, la vue produit occupe la place. Retour par
  `← Ferments` ou **Échap**.
- **Vue produit** : la rangée `[colonne de gauche | graphes]` remplit la hauteur
  disponible et la colonne de gauche s'étire à la même hauteur — c'est ce qui aligne les
  deux bas de section **et** supprime tout vide en bas. Ne pas plafonner la rangée
  (recrée un trou en bas, d'autant plus grand que l'écran est haut) ni les graphes
  (décale le bas des deux colonnes).
- Conséquence assumée : la hauteur des graphes suit celle de l'écran (≈ 275 px à 640 de
  haut, 371 px à 832, 495 px à 1080). Le plancher `min-h-[120px]` protège les petits écrans.
- **Budget de hauteur** : à 1024×640 la colonne de gauche dispose de **566 px** et c'est
  elle qui décide si la page défile. Toute addition doit être financée.
- **Critère d'acceptation** : écart de défilement vertical **et** horizontal à 0 sur les
  trois vues, de 1024×640 à 1920×1080, et bas des deux colonnes de la vue produit au même
  pixel.

# 10. Couleurs et animation

- Fond anthracite : `--color-anthracite-950 #101113`, `900 #17181b`, `850 #1d1f23`,
  `800 #24272b`, `700 #2f3237` (déclarés en `@theme`).
- **Vert / ambre / rouge = réservés aux états**, jamais décoratifs. **Seule entorse :**
  la pastille « Chauffe » est rouge, parce que le rouge y désigne le geste de la machine
  et non l'état du produit.
- **Une teinte par grandeur suivie** : température `#7fb2ff` (bleu,
  `text-metric-temperature`), humidité `#4fd1c5` (turquoise, `text-teal-300`), densité
  `#a78bfa` (violet, `text-violet-300`). Ces teintes servent au trait, à l'aire sous la
  courbe et à la valeur de la grandeur. **Les consignes restent en gris neutre** : ce sont
  des références, pas des mesures.
- **La couleur d'état n'apparaît que dans la pastille.** Le chiffre de tête est en
  `text-zinc-100`, les écarts en `text-zinc-400`. C'est un choix assumé contre le
  « lisible à trois mètres » du brief d'origine.
- **Le `font-mono` est réservé aux identifiants bruts** (`entity_id`, motifs de sélection
  de famille). Tous les nombres — chiffres de tête compris — sont en sans-serif avec
  `tabular-nums`. À `text-4xl`, la chasse fixe donnait à la virgule une cellule entière :
  un « 19 , 6 » troué, qui pesait plus lourd que le reste de la carte.
- Les majuscules espacées (`uppercase tracking-[0.14em]`) ont été abandonnées : elles
donnaient un aspect technique et daté.
- **Aucune ombre portée** : la hiérarchie ne tient qu'aux fonds et à un filet.
- Une seule animation : `--animate-bubble: bubble-rise 6s linear infinite` avec
  `@keyframes bubble-rise` (`translateY(0) scale(.6)` → `translateY(-86px) scale(1.15)`,
  opacité 0 → 0,9 → 0,5 → 0), **toujours** doublée de `motion-reduce:animate-none`.

# 11. Vérifications après toute modification

1. `npm run build` : `tsc --noEmit && vite build`, sans erreur.
2. Dans le navigateur : les 5 cartes, la pastille d'état, l'ouverture d'une carte → vue
   pleine page (illustration, relevés, commande de consigne, régulation, synthèse,
   2 graphes), Échap → retour ; les valeurs bougent toutes les 2 s.
3. **Aucun défilement** à 1024×640, 1280×700, 1470×760 et 1920×1080, sur les trois vues
   (Accueil, Produit, Devices).
4. **Bas des deux colonnes de la vue produit au même pixel** : comparer
   `aside.getBoundingClientRect().bottom` au bas du dernier graphe.
5. Une page qui ne défile pas ne se juge pas à l'œil : mesurer
   `scrollHeight - clientHeight` et `scrollWidth - clientWidth`.

# 12. Pièges à éviter

- Tailwind v4 : pas de fichier de config, thème dans `@theme`, et **classes littérales
  uniquement** (tables de correspondance, jamais de template dynamique).
- Recharts : il faut un parent avec une hauteur résolue, d'où la chaîne `flex-1 min-h-0`
  plus un plancher de 120 px. Le `ResponsiveContainer` reste bloqué sur une mesure
  initiale de 0 × 0 : la boîte est mesurée nous-mêmes (`useMeasuredBox`, `ResizeObserver`)
  et passée en `width` / `height`. `isAnimationActive={false}` sur les courbes, sinon
  elles se ré-animent à chaque tick de 2 s.
- **Axe des ordonnées** : passer un `domain={[min, max]}` calculé **et** des `ticks` à pas
  rond. Sans cela Recharts élargit le domaine pour caser ses « nice values ».
- L'historique renvoyé à React doit être un **nouveau tableau** à chaque tick, sinon les
  `useMemo` des graphes ne se recalculent pas.
- Sous-échantillonner à ~320 points avant de tracer (2 880 points bruts par ferment).
- Une carte est un `<button>` : n'y mettre que du contenu « phrasing » (des `<span>`).
- Un écart d'humidité ne se juge pas sur les seuils en °C : bandes équivalentes en points
  de % (2 / 5).
- **Échap** : `App` l'écoute sur `window`. Tout champ qui veut l'intercepter doit faire
  `stopPropagation`, sinon annuler ferme la vue.
- Le **jeton Home Assistant** ne doit jamais atteindre le navigateur : il est injecté par
  le proxy de `vite.config.ts`. `.env.local` est gitignoré.
- Modifier `.env.local` ne déclenche pas de rechargement à chaud : redémarrer
  `npm run dev` (`loadEnv` n'est lu qu'au démarrage du serveur).
- Si tu supprimes un ferment pendant que la page est ouverte, le rechargement à chaud
  peut lever une erreur car l'id sélectionné n'existe plus dans l'état React : un
  rechargement complet règle le problème.