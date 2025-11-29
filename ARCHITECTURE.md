# Architecture du Moniteur de Fermentation

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Nginx)                  │
│                    http://192.168.1.140:80                   │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│   BACKEND API (Node.js)  │  │   Shelly Devices         │
│   Express + InfluxDB     │  │   (via /shelly/ proxy)   │
│   Port 3001              │  │                          │
└──────────────────────────┘  └──────────────────────────┘
            │
   ┌────────┴────────┐
   │                 │
   ▼                 ▼
┌──────────┐  ┌──────────────┐
│ InfluxDB │  │    SQLite    │
│ (Séries  │  │ (Métadonnées)│
│temporel) │  │              │
└──────────┘  └──────────────┘
            │
            ▼
┌─────────────────────────────┐
│    Home Assistant API       │
│    (Capteurs Zigbee)        │
│    http://192.168.1.140:8124│
└─────────────────────────────┘
```

## Composants

### 1. Frontend (React + TypeScript)
- **Localisation** : `/src`
- **Port** : 80 (via Nginx)
- **Fonctionnalités** :
  - Interface utilisateur pour la gestion des projets
  - Visualisation des graphiques de température et densité
  - Contrôle des prises Shelly
  - Gestion des appareils (sondes et prises)

### 2. Backend API (Node.js + Express)
- **Localisation** : `/backend`
- **Port** : 3001
- **Base de données** :
  - **InfluxDB** : Stockage des données de température et densité
  - **SQLite** : Métadonnées (projets, appareils)
- **Services** :
  - API REST pour le frontend
  - Service de polling des capteurs Home Assistant (toutes les 30s)
  - Contrôle automatique des prises Shelly basé sur la température

### 3. InfluxDB
- **Version** : 2.7-alpine
- **Port** : 8086
- **Organisation** : `fermentation`
- **Bucket** : `sensors`
- **Stockage** :
  - Mesure `temperature` : température par projet avec timestamp
  - Mesure `density` : densité par projet avec timestamp

### 4. Nginx
- **Rôle** : Reverse proxy
- **Proxies** :
  - `/api/*` → Backend API (fermentation-backend:3001)
  - `/shelly/*` → Appareils Shelly (par IP dynamique)

## Structure des données

### InfluxDB - Measurements

#### Temperature
```
measurement: temperature
tags:
  - project_id: string
fields:
  - value: float (température en °C)
timestamp: nanoseconds
```

#### Density
```
measurement: density
tags:
  - project_id: string
fields:
  - value: float (densité SG)
timestamp: nanoseconds
```

### SQLite - Tables

#### projects
```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  fermentation_type TEXT NOT NULL,  -- 'beer' | 'wine' | 'cheese' | 'bread'
  sensor_id TEXT NOT NULL,
  outlet_id TEXT NOT NULL,
  target_temperature REAL NOT NULL,
  current_temperature REAL NOT NULL DEFAULT 20.0,
  outlet_active INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
```

#### devices
```sql
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'sensor' | 'outlet'
  ip TEXT NOT NULL,
  entity_id TEXT NOT NULL
);
```

## API Endpoints

### Projects
- `GET /api/projects` - Liste tous les projets
- `GET /api/projects/:id?start=-30d` - Récupère un projet avec son historique
- `POST /api/projects` - Créer un nouveau projet
- `PUT /api/projects/:id/target` - Modifier la température cible
- `POST /api/projects/:id/outlet/toggle` - Basculer l'état de la prise
- `POST /api/projects/:id/density` - Ajouter une mesure de densité
- `DELETE /api/projects/:id` - Supprimer un projet

### Devices
- `GET /api/devices` - Liste tous les appareils
- `GET /api/devices/:id` - Récupère un appareil
- `POST /api/devices` - Créer un nouvel appareil
- `DELETE /api/devices/:id` - Supprimer un appareil

## Variables d'environnement

### Backend
```env
# InfluxDB
INFLUX_URL=http://influxdb:8086
INFLUX_TOKEN=my-super-secret-auth-token
INFLUX_ORG=fermentation
INFLUX_BUCKET=sensors

# Home Assistant
HOME_ASSISTANT_URL=http://192.168.1.140:8124
HOME_ASSISTANT_TOKEN=

# Polling
POLL_INTERVAL=30000  # 30 secondes

# Base de données
DB_PATH=/data/fermentation.db

# API
PORT=3001
```

## Déploiement K3s

### Volumes persistants
- **influxdb-pvc** : 10Gi pour les données InfluxDB
- **backend-data-pvc** : 1Gi pour SQLite

### Services
1. **influxdb** : InfluxDB 2.7
2. **fermentation-backend** : Backend API Node.js
3. **fermentation-monitor** : Frontend React + Nginx

## Flux de données

### Collecte de température automatique
1. Le service de polling interroge Home Assistant toutes les 30s
2. Récupère la température de chaque capteur assigné à un projet
3. Enregistre dans InfluxDB (measurement: `temperature`)
4. Met à jour `current_temperature` dans SQLite
5. Compare avec `target_temperature` et contrôle automatiquement la prise Shelly

### Ajout manuel de densité
1. L'utilisateur ajoute une mesure via le frontend
2. Frontend → `POST /api/projects/:id/density`
3. Backend enregistre dans InfluxDB (measurement: `density`)
4. Frontend récupère l'historique mis à jour

### Consultation de l'historique
1. Frontend → `GET /api/projects/:id?start=-30d`
2. Backend :
   - Lit les métadonnées depuis SQLite
   - Interroge InfluxDB pour l'historique de température
   - Interroge InfluxDB pour l'historique de densité
3. Retourne le projet complet avec les historiques

## Intégration Home Assistant

### Prérequis
- Home Assistant installé et accessible sur le réseau
- Zigbee2MQTT configuré avec :
  - Adaptateur USB Zigbee (SONOFF ZBDongle-E recommandé)
  - Sondes Zigbee SONOFF SNZB-02LD appairées
- API Home Assistant accessible (socat proxy sur port 8124)

### Configuration des appareils
Chaque appareil dans la table `devices` contient :
- `entity_id` : ID de l'entité Home Assistant (ex: `sensor.cave_temp`)
- `ip` : Adresse IP (pour les prises Shelly)
- `type` : `sensor` ou `outlet`

## Sécurité

### Tokens et authentification
- **InfluxDB** : Token d'admin stocké dans ConfigMap K8s
- **Home Assistant** : Token optionnel (variable `HOME_ASSISTANT_TOKEN`)
- **Shelly** : Accès direct via IP locale (réseau privé)

### Réseau
- Tous les services communiquent en interne via K3s
- Seul Nginx est exposé sur le port 80
- Shelly et Home Assistant sont accédés depuis le backend (pas depuis le frontend)

## Évolutions futures

### Améliorations possibles
1. **Grafana** : Intégration pour visualisation avancée des données InfluxDB
2. **Alertes** : Notifications (email, Telegram) si température hors limites
3. **Downsampling** : Agrégation automatique des vieilles données (moyennes horaires/journalières)
4. **Multi-tenant** : Support de plusieurs utilisateurs avec authentification
5. **Prédictions** : ML pour prédire l'évolution de la fermentation
6. **Export** : Export des données en CSV/Excel
7. **API Home Assistant bidirectionnelle** : Créer des entités dans HA pour chaque projet

## Maintenance

### Backup
- **InfluxDB** : Volume persistant `/var/lib/influxdb2`
- **SQLite** : Volume persistant `/data/fermentation.db`

Recommandation : Backup régulier des PVCs K3s

### Logs
- Backend : Logs dans stdout (accessible via `kubectl logs`)
- Polling service : Log de chaque cycle de polling

### Monitoring
- Endpoint de santé : `GET /health` (backend)
