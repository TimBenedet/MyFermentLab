# BrewSCADA V2

Application web de monitoring de fermentation pour homebrewing, hydromel, koji et culture de champignons. Interface SCADA temps-reel connectee a Home Assistant via un backend Node.js.

## Fonctionnalites

### Types de projets

- **Biere** : suivi de densite (OG/FG), 6 templates (IPA, Stout, Wheat, Pilsner, Saison, Porter)
- **Hydromel** : fermentation longue avec calcul d'alcool
- **Koji** : culture d'Aspergillus avec controle temperature + humidite (Riz blanc, Orge)
- **Champignons** : colonisation de substrat avec humidite (Pleurotes, Shiitake)

### Monitoring temps-reel

- Polling toutes les 3s vers Home Assistant (sondes de temperature, humidite, prises connectees)
- Graphiques Recharts avec plages : 1h, 6h, 24h, 7j, 30j, Tout
- Historique stocke dans InfluxDB via le backend
- Controle automatique des prises (chauffage) base sur la temperature cible
- Seuil d'activation configurable par projet (0.1 a 5°C, defaut 0.2°C)

### Gestion de projets

- Creation avec templates de recettes pre-remplis
- Edition des ingredients et etapes pendant la fermentation
- Archivage avec export PDF (resume, metriques, historique)
- Suppression/archivage synchronise avec le backend

### Authentification

- **Admin** : acces complet (creation, edition, controle des appareils)
- **Viewer** : lecture seule
- **Simulation** : mode hors-ligne sans backend

### Gestion des appareils

- Ajout/modification/suppression de sondes et prises Home Assistant
- Liaison automatique sonde temperature, sonde humidite, prise par projet
- Affichage de l'entity ID Home Assistant

## Stack technique

| Couche | Technologies |
|--------|-------------|
| Frontend | React 19, TypeScript 5.7, Vite 6 |
| UI | Tailwind CSS 3.4, theme SCADA dark custom |
| Graphiques | Recharts 2.15 |
| Icones | Lucide React |
| Routing | React Router DOM 7 |
| Backend | Node.js, Express, InfluxDB (repo separe) |
| IoT | Home Assistant API |
| Deploy | Docker (Nginx Alpine), K3s, ArgoCD |

## Structure du projet

```
src/
  pages/
    LoginPage.tsx          # Authentification (admin/viewer/simulation)
    HomePage.tsx           # Dashboard des projets actifs
    ProjectDetailPage.tsx  # Detail d'un projet avec graphiques et controles
    CreateProjectPage.tsx  # Creation de projet avec templates
    ArchivesPage.tsx       # Projets archives avec export PDF
    DevicesPage.tsx        # Gestion des appareils Home Assistant
  components/
    layout/                # Header, AppLayout, FermentLogo
    charts/                # TemperatureChart, GravityChart, HumidityChart
    vessels/               # SVG: VesselSVG, KojiTraySVG, MushroomBagSVG
    project/               # ProjectCard, ProjectControls, IngredientEditor, StepEditor
    panels/                # MetricsPanel
    fermenter/             # RelayIndicator
  context/
    BrewingContext.tsx      # State global (fermenters, projets, archives, alarmes)
    ConnectionContext.tsx   # Auth, mode live/simulation
  hooks/
    useLiveSync.ts          # Import et polling backend
  api/
    client.ts               # Client HTTP avec auth Bearer
    auth.ts                 # Login, token, verification
    projects.ts             # CRUD projets, historique, archive
    devices.ts              # CRUD appareils
  types/
    brewing.ts              # Types domaine (BrewProject, Fermenter, Recipe, etc.)
    backend.ts              # Types API (BackendProject, BackendDevice)
  simulation/
    constants.ts            # Templates, factories, couleurs SRM
backend/
  src/
    routes/
      projects.routes.ts    # API projets, live-temperature, controle prises
      auth.routes.ts        # Authentification admin/viewer
      devices.routes.ts     # CRUD appareils Home Assistant
    services/
      database.service.ts   # SQLite (projets, appareils, migrations)
      sensor-poller.service.ts # Polling periodique des sondes HA
      influx.service.ts     # Ecriture/lecture InfluxDB
      stats.service.ts      # Calcul statistiques projets
```

## Developpement

```bash
# Installation
npm ci

# Serveur de dev (port 5173)
npm run dev

# Build production
npm run build

# Apercu du build
npm run preview
```

## Deploiement

### Docker

```bash
docker build -t brewscada-v2 .
docker run -p 80:80 brewscada-v2
```

Le conteneur Nginx sert le SPA et proxifie `/api/` vers `fermentation-backend:3001`.

### K3s + ArgoCD

L'application est deployee sur un cluster K3s homelab via ArgoCD :

- **Branche** : `scada-v2`
- **Frontend web** : NodePort 30084
- **Frontend mobile** : NodePort 30085
- **Backend** : ClusterIP `fermentation-backend:3001`

```bash
# Refresh ArgoCD et restart
kubectl patch application myfermentlab-scada-v2 -n argocd \
  --type merge -p '{"metadata":{"annotations":{"argocd.argoproj.io/refresh":"hard"}}}'
kubectl rollout restart deployment/fermentation-monitor-scada-v2 -n default
```

## Architecture

```
Navigateur <---> Nginx (SPA + proxy)
                    |
                    v
              Backend Express
                 /       \
     Home Assistant    InfluxDB
     (sondes, prises)  (historique)
```

**Flux de donnees live :**

1. `useLiveSync` poll `GET /api/projects/:id/live-temperature` toutes les 3s
2. Le backend lit la sonde via Home Assistant, enregistre dans InfluxDB
3. Le backend evalue le controle automatique (seuil configurable par projet, defaut 0.2°C) et commande la prise
4. Le frontend met a jour le state local et les graphiques
5. Les projets archives sont ignores par le sensor poller (pas de controle de prise ni d'enregistrement)

**Flux de donnees historiques :**

1. L'utilisateur selectionne une plage > 1h
2. `fetchProjectHistory()` appelle `GET /api/projects/:id`
3. Le backend retourne les points depuis InfluxDB (temperature + humidite)
4. Downsampling a 500 points max pour les grands jeux de donnees

## Theme SCADA

Interface sombre optimisee pour le monitoring industriel :

| Variable | Couleur | Usage |
|----------|---------|-------|
| `scada-bg` | `#0a0a0f` | Fond principal |
| `scada-card` | `#1a1a25` | Cartes |
| `scada-accent` | `#00d4aa` | Elements actifs, accents |
| `scada-warning` | `#ffaa00` | Alertes |
| `scada-danger` | `#ff4757` | Erreurs, suppression |
| `scada-cold` | `#4a9eff` | Humidite, froid |

## API Backend

### Authentification

| Methode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/login` | Connexion admin (mot de passe) |
| POST | `/api/auth/viewer` | Session lecture seule |
| GET | `/api/auth/verify` | Verification du token |

### Projets

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/projects` | Liste tous les projets |
| POST | `/api/projects` | Creer un projet |
| GET | `/api/projects/:id` | Projet + historique InfluxDB |
| PATCH | `/api/projects/:id` | Mise a jour partielle (seuil d'activation, humidite, etc.) |
| PUT | `/api/projects/:id/target` | Modifier la temperature cible |
| DELETE | `/api/projects/:id` | Supprimer un projet |
| GET | `/api/projects/:id/live-temperature` | Temperature temps-reel + controle auto |
| GET | `/api/projects/:id/live-humidity` | Humidite temps-reel |
| PUT | `/api/projects/:id/archive` | Archiver |
| PUT | `/api/projects/:id/unarchive` | Desarchiver |
| PUT | `/api/projects/:id/control-mode` | Mode auto/manuel |
| POST | `/api/projects/:id/outlet/toggle` | Basculer la prise |

### Appareils

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/devices` | Liste des appareils |
| POST | `/api/devices` | Ajouter un appareil |
| PUT | `/api/devices/:id` | Modifier un appareil |
| DELETE | `/api/devices/:id` | Supprimer un appareil |

## Licence

Projet prive.
