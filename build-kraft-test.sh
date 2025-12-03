#!/bin/bash
# Script pour construire et déployer le frontend test avec le thème Kraft

set -e

echo "=== Construction de l'image Docker kraft-test ==="
docker build -t ghcr.io/timbenedet/myfermentlab-frontend:kraft-test .

echo "=== Push vers GitHub Container Registry ==="
docker push ghcr.io/timbenedet/myfermentlab-frontend:kraft-test

echo "=== Déploiement du pod de test ==="
kubectl apply -f manifests/frontend-test.yaml

echo "=== Redémarrage du déploiement ==="
kubectl rollout restart deployment/fermentation-monitor-test

echo ""
echo "=== Déploiement terminé ==="
echo "Le frontend de test est accessible sur le port 30081"
echo "URL: http://<IP_SERVEUR>:30081"
