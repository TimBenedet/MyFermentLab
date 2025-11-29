# Guide de Déploiement - Moniteur de Fermentation

## Prérequis

- Serveur Debian avec K3s installé (192.168.1.140)
- Docker Desktop sur votre Mac
- Home Assistant accessible sur le réseau
- Accès SSH au serveur Debian

## Étape 1 : Build des images Docker sur Mac

### 1.1 Build du Backend

```bash
cd /Volumes/T7/Claude-IA/backend
docker buildx build --platform linux/amd64 -t fermentation-backend:latest .
docker save fermentation-backend:latest > /tmp/fermentation-backend-amd64.tar
```

### 1.2 Build du Frontend

```bash
cd /Volumes/T7/Claude-IA
# Nettoyer les fichiers macOS
find . -name "._*" -type f -delete

docker buildx build --platform linux/amd64 -t fermentation-monitor:latest .
docker save fermentation-monitor:latest > /tmp/fermentation-monitor-amd64.tar
```

## Étape 2 : Transfert vers le serveur Debian

```bash
scp /tmp/fermentation-backend-amd64.tar tim@192.168.1.140:/tmp/
scp /tmp/fermentation-monitor-amd64.tar tim@192.168.1.140:/tmp/
```

## Étape 3 : Import des images sur le serveur

```bash
ssh tim@192.168.1.140

# Import des images dans K3s
sudo k3s ctr images import /tmp/fermentation-backend-amd64.tar
sudo k3s ctr images import /tmp/fermentation-monitor-amd64.tar

# Vérifier que les images sont bien importées
sudo k3s ctr images list | grep fermentation
```

## Étape 4 : Transfert des manifestes K8s

```bash
# Sur votre Mac
scp -r /Volumes/T7/Claude-IA/k8s tim@192.168.1.140:~/
```

## Étape 5 : Déploiement sur K3s

```bash
# Se connecter au serveur
ssh tim@192.168.1.140

# Déployer InfluxDB
kubectl apply -f ~/k8s/influxdb.yaml

# Attendre qu'InfluxDB soit prêt (peut prendre 1-2 minutes)
kubectl wait --for=condition=ready pod -l app=influxdb --timeout=300s

# Déployer le Backend
kubectl apply -f ~/k8s/backend.yaml

# Attendre que le backend soit prêt
kubectl wait --for=condition=ready pod -l app=fermentation-backend --timeout=300s

# Déployer le Frontend (si vous avez mis à jour le manifeste)
kubectl rollout restart deployment/fermentation-monitor
```

## Étape 6 : Vérification

```bash
# Vérifier l'état des pods
kubectl get pods

# Vous devriez voir :
# NAME                                    READY   STATUS    RESTARTS   AGE
# influxdb-xxxxx                         1/1     Running   0          2m
# fermentation-backend-xxxxx             1/1     Running   0          1m
# fermentation-monitor-xxxxx             1/1     Running   0          30s

# Vérifier les logs du backend
kubectl logs -l app=fermentation-backend --tail=50 -f

# Vous devriez voir :
# [Server] Backend API listening on port 3001
# [SensorPoller] Starting sensor polling service...
# [SensorPoller] Poll interval: 30000ms
```

## Étape 7 : Test de l'API

```bash
# Sur le serveur Debian, tester l'API backend
curl http://fermentation-backend:3001/health

# Devrait retourner : {"status":"ok"}

# Tester depuis l'extérieur (via Nginx)
# Sur votre Mac :
curl http://192.168.1.140/api/projects
```

## Étape 8 : Configuration initiale des appareils

1. Accédez à l'application : http://192.168.1.140
2. Allez dans "Gérer les appareils"
3. Ajoutez vos appareils :

### Exemple de sonde Zigbee :
- Nom : "Sonde Cave"
- Type : "sensor"
- IP : "192.168.1.100" (ou laisser vide)
- Entity ID : "sensor.cave_temp" (l'entity_id de Home Assistant)

### Exemple de prise Shelly :
- Nom : "Prise Tapis 1"
- Type : "outlet"
- IP : "192.168.1.157"
- Entity ID : "switch.heating_mat_1"

## Étape 9 : Créer votre premier projet

1. Cliquez sur "Nouveau Projet"
2. Remplissez les informations :
   - Nom : "Fermentation Bière 1"
   - Type : "Bière"
   - Sonde : Sélectionnez votre sonde
   - Prise : Sélectionnez votre prise
   - Température cible : 20°C
3. Validez

Le backend va automatiquement :
- Interroger la sonde toutes les 30 secondes
- Enregistrer les températures dans InfluxDB
- Contrôler la prise selon la température

## Dépannage

### Le backend ne démarre pas

```bash
# Vérifier les logs
kubectl logs -l app=fermentation-backend --tail=100

# Problèmes courants :
# - InfluxDB pas prêt → attendre quelques minutes
# - Problème de connexion SQLite → vérifier le volume persistant
```

### InfluxDB ne démarre pas

```bash
# Vérifier les logs
kubectl logs -l app=influxdb --tail=100

# Vérifier le PVC
kubectl get pvc influxdb-pvc

# Si le PVC est en "Pending", vérifier le stockage disponible
df -h
```

### Le polling des capteurs ne fonctionne pas

```bash
# Vérifier les logs du backend
kubectl logs -l app=fermentation-backend --tail=100 -f

# Vous devriez voir toutes les 30s :
# [SensorPoller] Polling X projects...

# Si erreur "Failed to fetch sensor" :
# - Vérifier que Home Assistant est accessible depuis le cluster K3s
# - Tester manuellement :
kubectl exec -it deployment/fermentation-backend -- sh
curl http://192.168.1.140:8124/api/states/sensor.cave_temp
```

### La prise Shelly ne répond pas

```bash
# Vérifier que la prise est accessible
ping 192.168.1.157

# Tester l'API Shelly depuis le pod backend
kubectl exec -it deployment/fermentation-backend -- sh
curl http://192.168.1.157/rpc/Switch.Set?id=0&on=true
```

## Mise à jour de l'application

### Mise à jour du frontend uniquement

```bash
# Sur Mac
cd /Volumes/T7/Claude-IA
docker buildx build --platform linux/amd64 -t fermentation-monitor:latest .
docker save fermentation-monitor:latest > /tmp/fermentation-monitor-amd64.tar
scp /tmp/fermentation-monitor-amd64.tar tim@192.168.1.140:/tmp/

# Sur serveur
ssh tim@192.168.1.140
sudo k3s ctr images import /tmp/fermentation-monitor-amd64.tar
kubectl rollout restart deployment/fermentation-monitor
```

### Mise à jour du backend

```bash
# Sur Mac
cd /Volumes/T7/Claude-IA/backend
docker buildx build --platform linux/amd64 -t fermentation-backend:latest .
docker save fermentation-backend:latest > /tmp/fermentation-backend-amd64.tar
scp /tmp/fermentation-backend-amd64.tar tim@192.168.1.140:/tmp/

# Sur serveur
ssh tim@192.168.1.140
sudo k3s ctr images import /tmp/fermentation-backend-amd64.tar
kubectl rollout restart deployment/fermentation-backend
```

## Backup des données

### Backup InfluxDB

```bash
# Créer un backup
kubectl exec -it deployment/influxdb -- influx backup /var/lib/influxdb2/backup

# Copier le backup localement
kubectl cp influxdb-xxxxx:/var/lib/influxdb2/backup ./influxdb-backup
```

### Backup SQLite

```bash
# Copier la base de données
kubectl exec -it deployment/fermentation-backend -- cat /data/fermentation.db > fermentation-backup.db
```

## Accès à InfluxDB UI

Si vous voulez accéder à l'interface web d'InfluxDB :

```bash
# Port-forward pour accéder depuis votre Mac
kubectl port-forward svc/influxdb 8086:8086

# Puis ouvrir dans le navigateur : http://localhost:8086
# Login : admin / adminpassword
```

## Variables d'environnement à personnaliser

Si vous avez besoin de modifier la configuration :

```bash
# Éditer le ConfigMap du backend
kubectl edit configmap backend-config

# Modifier par exemple :
# - HOME_ASSISTANT_URL : si votre Home Assistant est sur une autre adresse
# - POLL_INTERVAL : pour changer la fréquence de polling (en millisecondes)
# - HOME_ASSISTANT_TOKEN : si vous avez activé l'authentification

# Puis redémarrer le backend
kubectl rollout restart deployment/fermentation-backend
```

## Support

Pour toute question ou problème :
1. Vérifier les logs : `kubectl logs -l app=fermentation-backend`
2. Vérifier l'état des pods : `kubectl get pods`
3. Consulter le fichier ARCHITECTURE.md pour comprendre le fonctionnement
