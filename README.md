# MyFermentLab - Système de Monitoring de Fermentation

Application complète de monitoring et contrôle de fermentation pour bière, vin et saké, avec intégration Home Assistant et InfluxDB.

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Utilisation](#utilisation)
- [Déploiement](#déploiement)
- [Développement](#développement)

## 🎯 Vue d'ensemble

MyFermentLab est une application web moderne permettant de :
- Surveiller en temps réel la température de fermentation
- Contrôler automatiquement ou manuellement un tapis chauffant via Home Assistant
- Suivre la densité (SG) pour les brassages de bière
- Visualiser l'évolution des paramètres sur des graphiques interactifs
- Calculer automatiquement l'ABV (taux d'alcool)

## ✨ Fonctionnalités

### Monitoring en temps réel
- **Température** : Affichage en temps réel depuis capteurs Home Assistant
- **Contrôle de prise** : Activation/désactivation du tapis chauffant
- **Modes de contrôle** :
  - **Automatique** : Contrôle automatique basé sur la température cible
  - **Manuel** : Contrôle manuel de la prise

### Suivi de fermentation
- **Graphiques de température** : Évolution sur 1h, 6h, 24h, 7j, 30j ou période complète
- **Suivi de densité** (bière) : Enregistrement manuel de la densité spécifique
- **Calcul ABV** : Calcul automatique du taux d'alcool

### Multi-types de fermentation
- 🍺 **Bière** : 15-25°C, avec suivi de densité
- 🍷 **Vin** : 18-28°C
- 🍶 **Saké** : 12-18°C

## 🏗 Architecture

\`\`\`
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Frontend  │─────▶│   Backend    │─────▶│  InfluxDB   │
│   (React)   │      │  (Express)   │      │             │
└─────────────┘      └──────────────┘      └─────────────┘
       │                     │
       │                     ▼
       │              ┌──────────────┐
       │              │    SQLite    │
       │              │   (Projets)  │
       │              └──────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│          Home Assistant                  │
│  - Capteurs température (Zigbee)        │
│  - Prises connectées (switch)           │
└─────────────────────────────────────────┘
\`\`\`

### Stack technique

**Frontend**
- React 18 avec TypeScript
- Recharts pour les graphiques
- Vite pour le build
- Nginx pour le serveur web

**Backend**
- Node.js avec Express
- TypeScript
- SQLite (better-sqlite3) pour les projets
- InfluxDB client pour les séries temporelles

**Infrastructure**
- Docker & Docker Compose
- Kubernetes (K3s)
- ArgoCD pour GitOps
- GitHub Actions pour CI/CD

## 📦 Prérequis

### Environnement de développement
- Node.js 20+
- npm ou yarn
- Docker (optionnel)

### Environnement de production
- Kubernetes cluster (K3s recommandé)
- ArgoCD
- InfluxDB 2.x
- Home Assistant avec :
  - Capteurs de température Zigbee
  - Prises connectées (switches)

## 🚀 Installation

### Développement local

1. **Cloner le repository**
\`\`\`bash
git clone https://github.com/TimBenedet/MyFermentLab.git
cd MyFermentLab
\`\`\`

2. **Installer les dépendances frontend**
\`\`\`bash
npm install
\`\`\`

3. **Installer les dépendances backend**
\`\`\`bash
cd backend
npm install
cd ..
\`\`\`

4. **Configurer les variables d'environnement**

Créer un fichier \`.env\` dans le dossier \`backend/\` :
\`\`\`env
INFLUX_URL=http://localhost:8086
INFLUX_TOKEN=your-influx-token
INFLUX_ORG=fermentation
INFLUX_BUCKET=sensors
HOME_ASSISTANT_URL=http://192.168.1.140:8124
POLL_INTERVAL=30000
DB_PATH=./data/fermentation.db
\`\`\`

5. **Démarrer en mode développement**

Terminal 1 - Frontend :
\`\`\`bash
npm run dev
\`\`\`

Terminal 2 - Backend :
\`\`\`bash
cd backend
npm run dev
\`\`\`

L'application sera accessible sur \`http://localhost:5173\`

## ⚙️ Configuration

### InfluxDB

1. Créer une organisation \`fermentation\`
2. Créer un bucket \`sensors\`
3. Générer un token d'accès
4. Configurer Home Assistant pour envoyer les données vers InfluxDB

### Home Assistant

Exemple de configuration pour les capteurs :

\`\`\`yaml
# configuration.yaml
sensor:
  - platform: mqtt
    name: "Temperature Fermentation"
    state_topic: "zigbee2mqtt/temperature_sensor"
    unit_of_measurement: "°C"
    value_template: "{{ value_json.temperature }}"

switch:
  - platform: mqtt
    name: "Tapis Chauffant"
    state_topic: "zigbee2mqtt/smart_plug"
    command_topic: "zigbee2mqtt/smart_plug/set"
    payload_on: '{"state": "ON"}'
    payload_off: '{"state": "OFF"}'
\`\`\`

## 📱 Utilisation

### Créer un projet de fermentation

1. Cliquer sur **"Nouveau projet"**
2. Remplir les informations :
   - Nom du projet
   - Type de fermentation (Bière/Vin/Saké)
   - Capteur de température
   - Prise connectée
   - Température cible
   - Mode de contrôle (Auto/Manuel)

### Monitoring

- **Température actuelle** : Affichée en temps réel
- **Graphique** : Sélectionner la période à visualiser
- **Contrôle** :
  - Mode automatique : Le système contrôle automatiquement la prise
  - Mode manuel : Contrôle manuel via le bouton

### Ajouter une mesure de densité (Bière)

1. Cliquer sur **"+ Ajouter une mesure"**
2. Entrer la densité spécifique (ex: 1.050)
3. Optionnel : Modifier la date/heure
4. L'ABV est calculé automatiquement

## 🐳 Déploiement

### Docker Compose (Développement)

\`\`\`bash
docker-compose up -d
\`\`\`

### Kubernetes avec ArgoCD

1. **Appliquer les manifests**
\`\`\`bash
kubectl apply -f manifests/influxdb.yaml
kubectl apply -f manifests/backend.yaml
kubectl apply -f manifests/frontend.yaml
kubectl apply -f manifests/ingress.yaml
\`\`\`

2. **Configurer ArgoCD**
\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myfermentlab
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/TimBenedet/MyFermentLab.git
    targetRevision: main
    path: manifests
  destination:
    server: https://kubernetes.default.svc
    namespace: default
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
\`\`\`

3. **Accéder à l'application**
\`\`\`
http://ferment.local (ou votre domaine configuré)
\`\`\`

### CI/CD avec GitHub Actions

Les workflows sont automatiquement déclenchés lors des push :
- \`build-frontend.yml\` : Build et push de l'image frontend
- \`build-backend.yml\` : Build et push de l'image backend

Les images sont publiées sur GitHub Container Registry :
- \`ghcr.io/timbenedet/myfermentlab-frontend:latest\`
- \`ghcr.io/timbenedet/myfermentlab-backend:latest\`

## 🛠 Développement

### Structure du projet

\`\`\`
MyFermentLab/
├── src/                      # Frontend React
│   ├── components/          # Composants réutilisables
│   ├── pages/              # Pages de l'application
│   ├── services/           # Services API
│   └── types/              # Types TypeScript
├── backend/                 # Backend Express
│   └── src/
│       ├── routes/         # Routes API
│       ├── services/       # Services métier
│       └── index.ts        # Point d'entrée
├── manifests/              # Manifests Kubernetes
├── public/                 # Assets statiques
└── Dockerfile             # Images Docker
\`\`\`

### Build pour production

**Frontend**
\`\`\`bash
npm run build
\`\`\`

**Backend**
\`\`\`bash
cd backend
npm run build
\`\`\`

### Tests

\`\`\`bash
npm test
\`\`\`

## 📊 API Backend

### Endpoints principaux

#### Projets
- \`GET /api/projects\` - Liste tous les projets
- \`GET /api/projects/:id\` - Détails d'un projet avec historique
- \`POST /api/projects\` - Créer un nouveau projet
- \`PUT /api/projects/:id/target-temperature\` - Modifier température cible
- \`PUT /api/projects/:id/outlet\` - Toggle prise
- \`PUT /api/projects/:id/control-mode\` - Changer mode de contrôle
- \`DELETE /api/projects/:id\` - Supprimer un projet

#### Densité
- \`POST /api/projects/:id/density\` - Ajouter une mesure de densité

#### Devices
- \`GET /api/devices\` - Liste des capteurs et prises Home Assistant

## 🤝 Contribution

Les contributions sont les bienvenues ! Pour contribuer :

1. Fork le projet
2. Créer une branche (\`git checkout -b feature/AmazingFeature\`)
3. Commit les changements (\`git commit -m 'Add AmazingFeature'\`)
4. Push vers la branche (\`git push origin feature/AmazingFeature\`)
5. Ouvrir une Pull Request

## 📝 License

Ce projet est sous licence MIT.

## 👤 Auteur

**Timothée Benedet**
- GitHub: [@TimBenedet](https://github.com/TimBenedet)
- Email: timothee.benedet@protonmail.com

## 🙏 Remerciements

- Home Assistant pour l'intégration domotique
- InfluxDB pour le stockage des séries temporelles
- Recharts pour les graphiques React
