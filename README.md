# MyFermentLab — tableau de bord de fermentation

Suivi de cinq ferments — bière, hydromel, koji, miso, garum — et bibliothèque de recettes
personnelles, dans une application **entièrement côté navigateur**.

Pas de serveur applicatif, pas de base de données, pas de routeur : `npm run dev` suffit à
tout voir. La seule dépendance externe est **Home Assistant**, en lecture (sondes) et en
commande (prises) — et son jeton ne quitte jamais le serveur.

---

## Les cinq ferments

Source unique de vérité : `src/config/fermentations.ts`.

| id | nom | type | T° cible | %HR cible | densité |
|---|---|---|---|---|---|
| `ipa` | Bière IPA | beer | 19,5 °C | — | 1,060 → 1,012 |
| `hydromel` | Hydromel | mead | 18 °C | — | 1,108 → 1,004 |
| `koji` | Koji | koji | 30 °C | 75 % | — |
| `miso` | Miso | miso | 30 °C | 72 % | — |
| `garum` | Garum | garum | 26 °C | 62 % | — |

**États** : `ok` / `warn` / `alarm`, sur des bandes de 0,2 °C et 1 °C, 2 pts et 5 pts de %HR.
**Régulation** : `Chauffe` / `Refroidissement` / `À consigne`, bande morte de 0,1 °C
(`src/lib/regulation.ts`).

Les mesures sont **simulées** : 24 h d'historique, un point toutes les 2 s, bruit et dérive
par canal, graine fixe par ferment pour que l'historique soit reproductible
(`src/simulation/engine.ts`). Seuls les appareils Home Assistant sont réels.

## Les trois vues

| Vue | Contenu |
|---|---|
| **Accueil** | les cinq ferments, puis les lots lancés depuis la bibliothèque |
| **Bibliothèque** | les recettes personnelles : création, modification, lancement en production |
| **Devices** | les entités Home Assistant suivies : sondes, prises |

## La bibliothèque de recettes

- **Six types de ferments** : `beer`, `mead`, `koji`, `miso`, `soy` (sauce soja), `garum`.
- **Référentiel d'ingrédients** : 126 entrées (36 malts, 59 houblons, 31 levures) avec
  producteur, emploi, aliases, et **recherche sans accents** (`src/config/ingredients/`).
  Un menu propose, il n'enferme pas : le texte libre reste possible.
- **EBC et AA** : au choix d'un malt ou d'un houblon, le **milieu de la fourchette publiée**
  remplit le champ, qui reste modifiable — la fiche du sac fait foi.
- **Calcul d'eau de brassage** : déduit du grain pesé et du volume visé, avec un **profil de
  matériel** commun à toutes les recettes et un catalogue de modèles de cuve.
  Le modèle est détaillé dans [`docs/eau-de-brassage.md`](docs/eau-de-brassage.md).
- **Production** : lancer une recette crée un lot suivi sur l'accueil, dont les prises sont
  **asservies** — sous la consigne on allume, à la consigne ou au-dessus on éteint.

## Démarrage

```bash
npm ci
npm run dev        # http://localhost:5173
```

```bash
npm run build      # tsc --noEmit && vite build
```

Le jeton Home Assistant vit dans `.env.local` (`HASS_URL` et `HASS_TOKEN`). Le serveur de
développement relaie `/ha` vers Home Assistant en y ajoutant l'en-tête d'autorisation : le
navigateur appelle une URL de même origine, et **le jeton n'apparaît jamais dans le
JavaScript servi**. En production, c'est nginx qui joue ce rôle.

## Stack

| Brique | Version | Rôle |
|---|---|---|
| React | 19.3 | le rendu |
| Vite | 8.3 | le serveur de développement et la construction |
| TypeScript | 7.0 | en mode `strict` |
| Tailwind CSS | 4.3 | via `@tailwindcss/vite`, thème dans `@theme` |
| Recharts | 3.10 | les graphes 24 h |

Trois dépendances de production en tout : React, React DOM et Recharts. Aucune autre sans en
parler d'abord — et jamais de backend.

## Structure du dépôt

| Chemin | Rôle |
|---|---|
| `src/config/` | les données : ferments, référentiel d'ingrédients, modèles de cuve |
| `src/lib/` | la logique pure : formatage, états, régulation, recettes, eau, matériel |
| `src/hooks/` | l'état persisté : recettes, productions, matériel, thème, flux |
| `src/components/` | le rendu |
| `src/simulation/` | le moteur de simulation local |
| `manifests/` | les manifestes Kubernetes déployés par Argo CD |
| `argocd/` | l'Application Argo CD |
| `.github/workflows/` | la chaîne de construction et de publication |
| `docs/` | la documentation de fond |
| `Prompt.md` | la spécification détaillée — elle **prime** en cas de divergence |
| `THEME.md` | les règles visuelles |

## Stockage

Tout vit dans `localStorage`, sous quatre clés versionnées, relues **défensivement** : une
entrée cassée est écartée une à une, elle ne vide jamais le magasin entier
(`src/lib/storage.ts`).

| Clé | Version | Contenu |
|---|---|---|
| `fermentation4.recipes` | 7 | les recettes, leurs appareils et leur volume visé |
| `fermentation4.productions` | 2 | les lots lancés |
| `fermentation4.equipment` | 1 | la cuve : évaporation, perte, absorption |
| `fermentation4.theme` | — | le thème clair ou sombre |

`src/types.ts` est le **seul point de synchronisation** du modèle de données.

## Conventions

- Interface **en français**, nombres au format `fr-FR` (virgule décimale, signe `−` U+2212,
  espace insécable étroite avant `%`).
- Pas de `any`, pas de `@ts-ignore`, pas de `@ts-expect-error`.
- **Classes Tailwind littérales uniquement** : jamais construites par concaténation.
- **Aucune couleur en dur** dans un composant : les surfaces passent par les classes du
  thème, les valeurs brutes de Recharts par `ChartPalette` (`src/lib/theme.ts`).
- Tailwind v4 se configure dans `@theme` (`src/index.css`) : **pas** de
  `tailwind.config.js` ni de `postcss.config.js`.
- **Rien ne défile** de 1024×640 à 1920×1080, colonne unique sous 640 px.
- Le rendu est à **125 %** (`html { zoom: 1.25 }`), avec les points de rupture mis à
  l'échelle et `calc(100dvh*0.8)` sur la coque : le `zoom` CSS n'est pas le zoom du
  navigateur, il ne suit ni les media queries ni `dvh`.
- Aucune API externe en dehors de Home Assistant.

## Déploiement

Une branche par version, **GitOps** : un `push` suffit, GitHub Actions construit l'image,
l'épingle dans le manifeste, et Argo CD la déploie sur le cluster K3s.
Voir [`DEPLOIEMENT.md`](DEPLOIEMENT.md) et [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Ce qui reste du projet précédent

`backend/`, `zigbee2mqtt/`, les `prototype-*.html`, `k8s-deployment.yaml`,
`deploy-backend.sh`, `reset-databases.sh`, `temperature-control.html`,
`hakko_labels-2.html`, `build-kraft-test.sh` : rien de tout cela n'est déployé ni utilisé
par l'application actuelle. Ces fichiers sont conservés dans l'historique git ; ils
peuvent être supprimés quand personne n'en a plus besoin.
