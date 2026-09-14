# Instructions — Dashboard de fermentation

## Le projet

Monitoring de fermentation, **données entièrement simulées côté client**. Pas de
backend, pas de base de données, pas de routing : `npm run dev` suffit à tout voir.

**Seule dépendance externe : Home Assistant**, en lecture et en commande, via la vue
« Devices » et un proxy du serveur de dev (`/ha`). Le jeton est injecté **côté
serveur** et n'atteint jamais le navigateur.

Stack : **Vite + React + TypeScript + Tailwind CSS v4 + Recharts**. Aucune autre
dépendance sans me demander.

Trois vues, dans la barre latérale : **Accueil** (les cinq ferments), **Bibliothèque**
(recettes personnelles) et **Devices** (Home Assistant). Les recettes sont des données
**locales** comme le thème : `localStorage`, clé `fermentation4.recipes`, aucun backend.

## Documents de référence

| Fichier | Rôle |
|---|---|
| `Prompt.md` | spécification détaillée — **prime en cas de divergence** |
| `THEME.md` | règles visuelles : surfaces, couleurs, typographie, mise en page |
| `src/types.ts` | modèle de données, seul point de synchronisation |

## Modèle de données

Déclaré dans `src/types.ts` : `FermentId`, `StatusLevel`, `Setpoints`, `Dynamics`,
`ChannelDynamics`, `GravitySetpoint`, `VesselConfig` (union discriminée
`tank` / `koji` / `crock`), `FermentConfig`, `Sample`, `FermentReading`, `Feed`,
et `Recipe` / `RecipeIngredient` / `RecipeUnit` (bibliothèque).

## Les cinq ferments

Source unique de vérité : `src/config/fermentations.ts`.

| id | nom | type | T° cible | %HR cible | densité |
|---|---|---|---|---|---|
| `ipa` | Bière IPA | beer | 19,5 °C | — | 1,060 → 1,012 |
| `hydromel` | Hydromel | mead | 18 °C | — | 1,108 → 1,004 |
| `koji` | Koji | koji | 30 °C | 75 % | — |
| `miso` | Miso | miso | 30 °C | 72 % | — |
| `garum` | Garum | garum | 26 °C | 62 % | — |

## États et seuils

- **Ferment** : `ok` / `warn` / `alarm` — bandes **0,2 °C / 1 °C** et **2 pts / 5 pts** de %HR.
- **Régulation** : `Chauffe` (rouge) / `Refroidissement` (bleu) / `À consigne` (émeraude),
  bande morte **0,1 °C**. Voir `src/lib/regulation.ts`.

## Règles générales

- Pas de `any`, pas de `@ts-ignore`, pas de `@ts-expect-error`.
- Aucune API externe sans me demander — Home Assistant est la seule exception, actée
  le 2026-09-11.
- Aucune installation globale. Aucun fichier hors du dossier du projet.
- **Classes Tailwind littérales uniquement** : jamais de classe construite par
  concaténation, sinon Tailwind ne la génère pas.
- **Aucune couleur en dur dans un composant.** Les surfaces et les textes passent par
  les classes (`anthracite-*`, `zinc-*`, états, grandeurs), qui suivent le thème clair
  ou sombre ; les valeurs brutes demandées par Recharts viennent de `ChartPalette`
  (`src/lib/theme.ts`). Voir `THEME.md`, section « Deux thèmes ».
- **Aucun `tailwind.config.js` ni `postcss.config.js`** : Tailwind v4 se configure dans
  `@theme`, dans `src/index.css`.
- `npm run build` = `tsc --noEmit && vite build`, sans erreur.
- Interface **en français**, nombres au format `fr-FR` (virgule décimale, signe `−` U+2212).
- **Rien ne défile** — ni verticalement ni horizontalement — de 1024×640 à 1920×1080 ;
  colonne unique sous 640 px. La colonne de gauche de la vue produit dispose de
  **566 px** à 1024×640 : toute addition doit être financée.
- Si un choix technique est ambigu, tranche et signale-le. Ne t'arrête pas pour me demander.

