#!/bin/bash

echo "=== Installation d'ArgoCD sur K3s ==="

# Créer le namespace argocd
echo "1. Création du namespace argocd..."
kubectl create namespace argocd

# Installer ArgoCD
echo "2. Installation d'ArgoCD..."
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Attendre que tous les pods soient prêts
echo "3. Attente du démarrage d'ArgoCD (peut prendre 2-3 minutes)..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s

# Exposer ArgoCD via NodePort pour accès local
echo "4. Exposition d'ArgoCD via NodePort..."
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "NodePort", "ports": [{"port": 443, "nodePort": 30443, "name": "https"}]}}'

# Récupérer le mot de passe initial
echo ""
echo "=== Configuration terminée ==="
echo ""
echo "ArgoCD est accessible sur : https://192.168.1.140:30443"
echo ""
echo "Login : admin"
echo "Password : $(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)"
echo ""
echo "IMPORTANT : Notez ce mot de passe, vous en aurez besoin pour vous connecter!"
echo ""
echo "Pour installer l'application ArgoCD :"
echo "  kubectl apply -f /home/homelab/k8s/argocd/application.yaml"
