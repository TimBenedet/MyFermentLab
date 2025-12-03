# Installation Zigbee2MQTT sur serveur Debian

## Prérequis

- Docker et Docker Compose installés
- Dongle SONOFF Zigbee branché sur `/dev/ttyUSB0`
- Permissions sur le port USB

## Installation

### 1. Copier les fichiers sur le serveur

```bash
# Sur ton serveur Debian, créer le dossier
mkdir -p ~/zigbee2mqtt
cd ~/zigbee2mqtt

# Copier les fichiers depuis ton Mac vers le serveur
scp -r /Volumes/T7/Claude-IA/zigbee2mqtt/* user@server-ip:~/zigbee2mqtt/
```

### 2. Vérifier les permissions USB

```bash
# Vérifier le port
ls -l /dev/ttyUSB0

# Ajouter l'utilisateur au groupe dialout
sudo usermod -aG dialout $USER

# Donner les permissions (temporaire)
sudo chmod 666 /dev/ttyUSB0

# Pour rendre permanent, créer une règle udev
sudo nano /etc/udev/rules.d/99-usb-serial.rules
# Ajouter :
# SUBSYSTEM=="tty", ATTRS{idVendor}=="1a86", ATTRS{idProduct}=="55d4", MODE="0666"

# Recharger les règles
sudo udevadm control --reload-rules
sudo udevadm trigger
```

### 3. Créer les dossiers nécessaires

```bash
cd ~/zigbee2mqtt

# Créer les dossiers pour Mosquitto
mkdir -p mosquitto/data mosquitto/log

# Donner les bonnes permissions
chmod -R 777 mosquitto/
chmod -R 777 zigbee2mqtt-data/
```

### 4. Démarrer les services

```bash
docker-compose up -d
```

### 5. Vérifier les logs

```bash
# Logs Zigbee2MQTT
docker logs -f zigbee2mqtt

# Logs Mosquitto
docker logs -f mosquitto
```

## Configuration Home Assistant

### 1. Ajouter l'intégration MQTT

Dans Home Assistant :
1. Aller dans **Paramètres > Appareils et services**
2. Cliquer sur **Ajouter une intégration**
3. Rechercher **MQTT**
4. Configurer :
   - **Broker** : `IP-du-serveur-zigbee2mqtt`
   - **Port** : `1883`
   - **Utilisateur** : (laisser vide si anonymous)
   - **Mot de passe** : (laisser vide si anonymous)

### 2. Activer la découverte automatique

L'intégration Zigbee2MQTT va automatiquement créer les entités dans Home Assistant.

## Appairer une sonde de température

### 1. Activer le mode appairage

Via l'interface web Zigbee2MQTT (`http://IP-serveur:8080`) :
- Cliquer sur **"Permit join"**
- Ou dans la configuration, `permit_join: true`

### 2. Mettre la sonde en mode appairage

Pour une sonde **Aqara WSDCGQ11LM** :
- Appuyer sur le bouton pendant 5 secondes jusqu'à ce que la LED clignote

### 3. Vérifier l'appairage

Dans Zigbee2MQTT, la sonde devrait apparaître avec un nom générique.
Elle sera aussi visible dans Home Assistant avec les entités :
- `sensor.xxx_temperature`
- `sensor.xxx_humidity`
- `sensor.xxx_battery`

### 4. Renommer l'appareil

Dans Zigbee2MQTT, renommer l'appareil avec un nom explicite :
- Exemple : `sonde_fermentation_biere`

## Accès aux interfaces

- **Zigbee2MQTT** : `http://IP-serveur:8080`
- **MQTT Broker** : `mqtt://IP-serveur:1883`
- **MQTT WebSocket** : `ws://IP-serveur:9001`

## Commandes utiles

```bash
# Démarrer les services
docker-compose up -d

# Arrêter les services
docker-compose down

# Redémarrer un service
docker-compose restart zigbee2mqtt

# Voir les logs en temps réel
docker-compose logs -f

# Voir les logs d'un service spécifique
docker logs -f zigbee2mqtt
docker logs -f mosquitto
```

## Désactiver le mode appairage

Une fois tous les appareils appairés, **IMPORTANT** :

Éditer `zigbee2mqtt-data/configuration.yaml` :
```yaml
permit_join: false  # Passer à false pour la sécurité
```

Puis redémarrer :
```bash
docker-compose restart zigbee2mqtt
```

## Troubleshooting

### Permission denied sur /dev/ttyUSB0

```bash
sudo chmod 666 /dev/ttyUSB0
sudo usermod -aG dialout $USER
# Se déconnecter et reconnecter
```

### Zigbee2MQTT ne démarre pas

```bash
# Vérifier le port USB
ls -l /dev/ttyUSB0

# Vérifier les logs
docker logs zigbee2mqtt
```

### Les appareils ne s'appairent pas

1. Vérifier que `permit_join: true`
2. Vérifier que le dongle est bien détecté
3. Rapprocher l'appareil du dongle
4. Réinitialiser l'appareil Zigbee (voir manuel)
