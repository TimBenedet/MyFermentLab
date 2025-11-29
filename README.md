# MyFermentLab

Système de monitoring et contrôle de fermentation avec Home Assistant, InfluxDB et K3s.

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + InfluxDB + SQLite
- **Déploiement**: K3s + ArgoCD (GitOps)
- **CI/CD**: GitHub Actions + GitHub Container Registry

## Structure du projet

```
.
├── src/                    # Frontend React
├── backend/                # Backend Node.js
├── manifests/              # Manifestes Kubernetes
│   ├── frontend.yaml
│   ├── backend.yaml
│   └── influxdb.yaml
├── argocd/                 # Configuration ArgoCD
│   ├── install-argocd.sh
│   └── application.yaml
└── .github/workflows/      # GitHub Actions CI/CD
```

## Déploiement

### 1. Installation d'ArgoCD

```bash
# Sur votre serveur K3s
chmod +x argocd/install-argocd.sh
./argocd/install-argocd.sh
```

### 2. Configuration du repository GitHub

Le projet utilise GitHub Container Registry (ghcr.io) pour stocker les images Docker.
Les GitHub Actions buildent automatiquement les images à chaque push.

### 3. Déploiement de l'application

```bash
# Appliquer la configuration ArgoCD
kubectl apply -f argocd/application.yaml
```

ArgoCD va automatiquement :
- Surveiller le repo GitHub
- Détecter les changements dans `manifests/`
- Déployer les mises à jour sur K3s

## Workflow de développement

1. **Modification du code** (frontend ou backend)
2. **Git push** vers GitHub
3. **GitHub Actions** build l'image Docker et la push vers ghcr.io
4. **ArgoCD** détecte le changement et redéploie automatiquement

## Accès

- **Application** : http://192.168.1.140
- **ArgoCD UI** : https://192.168.1.140:30443

## Documentation

- [Architecture complète](ARCHITECTURE.md)
- [Guide de déploiement manuel](DEPLOIEMENT.md)
