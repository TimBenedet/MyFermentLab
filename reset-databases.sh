#!/bin/bash

echo "=== Nettoyage des bases de données ==="

# Supprimer les PVCs pour forcer la recréation des bases
echo "1. Suppression des PersistentVolumeClaims..."
kubectl delete pvc backend-data-pvc influxdb-pvc

# Attendre la suppression
echo "2. Attente de la suppression des PVCs..."
sleep 5

# Redémarrer les pods pour qu'ils recréent les bases vides
echo "3. Redémarrage d'InfluxDB..."
kubectl delete pod -l app=influxdb

echo "4. Redémarrage du backend..."
kubectl delete pod -l app=fermentation-backend

# Attendre que les pods redémarrent
echo "5. Attente du redémarrage (peut prendre 1-2 minutes)..."
kubectl wait --for=condition=ready pod -l app=influxdb --timeout=300s
kubectl wait --for=condition=ready pod -l app=fermentation-backend --timeout=300s

echo ""
echo "=== État des pods ==="
kubectl get pods

echo ""
echo "=== Logs du backend ==="
kubectl logs -l app=fermentation-backend --tail=20

echo ""
echo "✅ Bases de données nettoyées !"
echo "Vous pouvez maintenant ajouter vos appareils et créer vos projets."
