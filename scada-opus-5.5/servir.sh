#!/bin/bash
# Démarre le serveur statique du dossier Scada-opus-5.5 (port 8090).
# Détaché du shell (setsid + nohup) : il survit à la déconnexion SSH.
# Sans sudo ni systemd ici : pour l'automatiser au démarrage,
#   crontab -e   puis   @reboot /home/homelab/Scada-opus-5.5/servir.sh
set -u

PORT=8090
DIR="/home/homelab/Scada-opus-5.5"
LOG="$DIR/.serveur.log"

if pgrep -f "http.server $PORT" > /dev/null; then
  echo "déjà en marche (pid $(pgrep -f "http.server $PORT" | tr '\n' ' '))"
else
  cd "$DIR" || { echo "dossier introuvable : $DIR"; exit 1; }
  setsid nohup python3 -m http.server "$PORT" --bind 0.0.0.0 > "$LOG" 2>&1 < /dev/null &
  disown 2>/dev/null || true
  sleep 1
  if pgrep -f "http.server $PORT" > /dev/null; then
    echo "démarré (pid $(pgrep -f "http.server $PORT" | tr '\n' ' '))"
  else
    echo "échec du démarrage, voir $LOG"; exit 1
  fi
fi

IP=$(hostname -I | awk '{print $1}')
echo "ouvert sur http://$IP:$PORT/"
echo "dashboard  : http://$IP:$PORT/hakko-dashboard.html"
