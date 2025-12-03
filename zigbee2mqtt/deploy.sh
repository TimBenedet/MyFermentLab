#!/bin/bash

# Script de déploiement Zigbee2MQTT sur serveur Debian
# Usage: ./deploy.sh <user@server-ip>

if [ -z "$1" ]; then
  echo "Usage: ./deploy.sh <user@server-ip>"
  echo "Exemple: ./deploy.sh debian@192.168.1.140"
  exit 1
fi

SERVER=$1
SSH_KEY="$HOME/.ssh/homelab_key"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no"

echo "📦 Déploiement de Zigbee2MQTT sur $SERVER"
echo ""

# Créer le dossier sur le serveur
echo "1️⃣  Création du dossier zigbee2mqtt..."
ssh $SSH_OPTS $SERVER "mkdir -p ~/zigbee2mqtt"

# Copier les fichiers
echo "2️⃣  Copie des fichiers de configuration..."
scp $SSH_OPTS -r docker-compose.yml $SERVER:~/zigbee2mqtt/
scp $SSH_OPTS -r zigbee2mqtt-data $SERVER:~/zigbee2mqtt/
scp $SSH_OPTS -r mosquitto $SERVER:~/zigbee2mqtt/
scp $SSH_OPTS README.md $SERVER:~/zigbee2mqtt/

# Créer les dossiers nécessaires et configurer les permissions
echo "3️⃣  Configuration des permissions..."
ssh $SSH_OPTS $SERVER "cd ~/zigbee2mqtt && \
  mkdir -p mosquitto/data mosquitto/log && \
  chmod -R 777 mosquitto/ && \
  chmod -R 777 zigbee2mqtt-data/ && \
  sudo usermod -aG dialout \$USER && \
  sudo chmod 666 /dev/ttyUSB0"

# Démarrer les services
echo "4️⃣  Démarrage des services Docker..."
ssh $SSH_OPTS $SERVER "cd ~/zigbee2mqtt && docker-compose up -d"

echo ""
echo "✅ Déploiement terminé !"
echo ""
echo "📊 Vérifier les logs :"
echo "   ssh $SERVER 'docker logs -f zigbee2mqtt'"
echo ""
echo "🌐 Accès à l'interface :"
echo "   Zigbee2MQTT: http://<server-ip>:8080"
echo "   MQTT Broker: mqtt://<server-ip>:1883"
echo ""
echo "⚠️  N'oublie pas de te déconnecter/reconnecter pour que les permissions prennent effet !"
