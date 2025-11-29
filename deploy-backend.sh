#!/bin/bash

echo "=== Déploiement de la stack backend ==="

# Déployer InfluxDB
echo "1. Déploiement d'InfluxDB..."
sudo kubectl apply -f /home/homelab/k8s/influxdb.yaml

# Attendre qu'InfluxDB soit prêt
echo "2. Attente du démarrage d'InfluxDB (peut prendre 1-2 minutes)..."
kubectl wait --for=condition=ready pod -l app=influxdb --timeout=300s

# Déployer le Backend
echo "3. Déploiement du backend..."
sudo kubectl apply -f /home/homelab/k8s/backend.yaml

# Attendre que le backend soit prêt
echo "4. Attente du démarrage du backend..."
kubectl wait --for=condition=ready pod -l app=fermentation-backend --timeout=300s

# Vérifier l'état
echo ""
echo "=== État des pods ==="
kubectl get pods

echo ""
echo "=== Logs du backend ==="
kubectl logs -l app=fermentation-backend --tail=20

echo ""
echo "=== Test de l'API ==="
curl -s http://fermentation-backend:3001/health || echo "Backend pas encore accessible (normal si premier démarrage)"

echo ""
echo "✅ Déploiement terminé !"
echo "Vous pouvez maintenant accéder à l'application sur http://192.168.1.140"
