#!/usr/bin/env bash
# Èprouve la surveillance du pont sans toucher à une prise réelle : un faux Home
# Assistant répond sur 18123, le pont tourne sur 18099 avec PONT_CHAUFFE_MAX=1.
# Deux comportements sont éprouvés, et ce sont eux qui protègent l'installation :
#   1. une chauffe commandée par la régulation (auto=true) est coupée par le pont ;
#   2. une commande manuelle (auto absent) n'est jamais coupée.
# La preuve est faite côté faux Home Assistant (la commande turn_off est arrivée) et
# côté pont (la ligne « interrompue » est écrite).
set -u
ICI=$(cd "$(dirname "$0")" && pwd)
# python est un binaire natif Windows : il ne comprend pas les chemins MSYS (/c/...) et
# chercherait C:\c\Users\... En plus des variables d'environnement, les ARGUMENTS doivent
# donc être passés en forme native (C:/Users/...).
ICI_N=$(cygpath -m "$ICI" 2>/dev/null || echo "$ICI")
PONT_PY="${PONT_PY:-$ICI_N/../pont/pont.py}"
PORT_PONT=18099
PORT_HA=18123
HA="http://127.0.0.1:$PORT_HA"
BASE="http://127.0.0.1:$PORT_PONT"
ENTITE=switch.faux
JOURNAL=$ICI/journal-surveillance.txt

# Ce poste n'a pas de python3 utilisable : l'alias du Microsoft Store existe comme chemin
# (« command -v » le trouve) mais échoue à l'exécution. On éprouve donc chaque candidat.
PY=""
for c in python3 python py; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1; then
    PY="$c"; break
  fi
done
[ -n "$PY" ] || { echo "aucun interpréteur python 3 utilisable"; exit 2; }
echo "interpréteur : $PY ($($PY -V 2>&1))"; echo "pont testé : $PONT_PY"

"$PY" "$ICI_N/faux-ha.py" "$PORT_HA" > "$ICI/faux-ha.log" 2>&1 &
PID_HA=$!
HASS_URL="$HA" HASS_TOKEN=faux PONT_AUTH=aucune PONT_PRISES="$ENTITE" \
  PONT_CHAUFFE_MAX=1 PONT_PORT=$PORT_PONT PONT_ADRESSE=127.0.0.1 \
  "$PY" "$PONT_PY" > "$JOURNAL" 2>&1 &
PID_PONT=$!
trap 'kill $PID_HA $PID_PONT 2>/dev/null; wait 2>/dev/null' EXIT

for i in $(seq 1 20); do
  [ "$(curl -s -m 2 "$BASE/api/sante" || true)" = "ok" ] && break
  sleep 0.5
done

etat() { curl -s -m 5 "$BASE/api/etat" | grep -o '"etat": *"[a-z]*"' | head -1 | sed 's/.*"\([a-z]*\)"$/\1/'; }

# L'échéance tombe à PONT_CHAUFFE_MAX minutes, et la surveillance passe toutes les 15 s :
# une durée fixe vérifierait tantôt avant, tantôt après. On attend donc l'état voulu.
attendre_etat() { # $1 = état voulu, $2 = secondes maximum
  local fin=$(( $(date +%s) + $2 ))
  while [ "$(date +%s)" -lt "$fin" ]; do
    [ "$(etat)" = "$1" ] && { etat; return 0; }
    sleep 5
  done
  etat
}
commander() { curl -s -m 30 -X POST -H 'Content-Type: application/json' -d "$1" "$BASE/api/prise"; echo; }

echo "=== 1. chauffe commandée par la régulation (auto=true) : le pont doit la couper seul ==="
echo "  avant : $(etat)"
echo "  réponse : $(commander '{"entite":"'"$ENTITE"'","allume":true,"auto":true}')"
echo "  après la commande : $(etat) (on attendu)"
echo "  attente de l'échéance (jusqu'à 150 s : 60 s de délai + le pas de 15 s)…"
APRES=$(attendre_etat off 150)
echo "  après l'échéance : $APRES (off attendu)"
if [ "$APRES" = "off" ] && grep -q "chauffe automatique de $ENTITE interrompue" "$JOURNAL"; then
  echo "  OK   le pont a coupé la chauffe automatique"
else
  echo "  KO   la chauffe automatique n'a pas été coupée (journal : $JOURNAL)"
fi

echo
echo "=== 2. commande manuelle (auto absent) : le pont ne doit jamais la couper ==="
echo "  réponse : $(commander '{"entite":"'"$ENTITE"'","allume":true}')"
echo "  après la commande : $(etat) (on attendu)"
echo "  attente de 130 s (largement au-delà de l'échéance), puis relecture…"
sleep 130
APRES2=$(etat)
echo "  après l'échéance : $APRES2 (on attendu : c'est l'utilisateur qui décide)"
if [ "$APRES2" = "on" ]; then
  echo "  OK   la commande manuelle survit à l'échéance"
else
  echo "  KO   la commande manuelle a été coupée à tort"
fi

echo
echo "=== journal du pont ==="
sed 's/^/  /' "$JOURNAL"
