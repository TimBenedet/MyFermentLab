#!/bin/bash
# Arrête le serveur statique du dossier Scada-opus-5.5 (port 8090).
PORT=8090
if pgrep -f "http.server $PORT" > /dev/null; then
  pkill -f "http.server $PORT"
  sleep 1
  pgrep -f "http.server $PORT" > /dev/null && echo "encore vivant" || echo "arrêté"
else
  echo "rien à arrêter sur le port $PORT"
fi
