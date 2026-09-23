#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# verif-k8s.sh - verification de bout en bout du dashboard Hakko servi par k3s
#
# Usage :
#   bash verif-k8s.sh [options]
#   chmod +x verif-k8s.sh && ./verif-k8s.sh [options]
#
# Options :
#   --url <base>        URL de base du service (defaut : http://192.168.1.51:30090)
#   --host <nom>        en-tete Host a envoyer (Ingress Traefik ; defaut : vide)
#   --sha <sha256>      empreinte sha256 attendue de hakko-dashboard.html
#   --attendu <texte>   chaine devant apparaitre dans index.html
#                       (defaut : Scada-opus-5.5)
#   --menu, -h, --help  affiche cette aide
#
# Codes de sortie : 0 = tous les controles passent, 1 = au moins un KO,
#                    2 = erreur d'usage ou outil manquant.
#
# Dependances : curl, sha256sum, grep, sed, awk, tr (outils standard).
# Fins de ligne LF. Pas de "set -e" : chaque echec est compte, jamais masque.
# Aucun acces reseau en dehors du service teste.
# ---------------------------------------------------------------------------

# --- valeurs par defaut -----------------------------------------------------
URL="http://192.168.1.51:30090"
HOST=""
SHA_ATTENDU=""
ATTENDU="Scada-opus-5.5"

# --- compteurs globaux ------------------------------------------------------
OK_NB=0
KO_NB=0
IGN_NB=0
ECHECS=""

# --- aide -------------------------------------------------------------------
afficher_menu() {
  cat <<'FIN_AIDE'
verif-k8s.sh - verification du dashboard Hakko servi par k3s

Usage :
  bash verif-k8s.sh [options]
  chmod +x verif-k8s.sh && ./verif-k8s.sh [options]

Options :
  --url <base>        URL de base du service (defaut : http://192.168.1.51:30090)
  --host <nom>        en-tete Host a envoyer, ex. scada.myfermentlab
                      (defaut : vide = pas d'en-tete Host)
  --sha <sha256>      empreinte sha256 attendue de /hakko-dashboard.html
  --attendu <texte>   chaine devant apparaitre dans /index.html
                      (defaut : Scada-opus-5.5)
  --menu, -h, --help  affiche cette aide

Controles effectues :
  1. HTTP 200 sur / , /hakko-dashboard.html , /index.html , /README.md
  2. corps de /healthz exactement "ok"
  3. presence de la chaine attendue dans /index.html
  4. egalite du sha256 de /hakko-dashboard.html (si --sha fourni)
  5. HTTP 404 sur /TimServer.md (fichier de mots de passe absent)
  6. HTTP 200 sur /_build/RAPPORT-FINAL.md et /_verify/RAPPORT.md
  7. en-tete Content-Type de /README.md contenant text/markdown
  8. racine via l'en-tete Host (si --host fourni)

Codes de sortie : 0 = tout OK, 1 = au moins un controle en echec,
                  2 = erreur d'usage ou outil manquant.
FIN_AIDE
}

# --- analyse des arguments --------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --url)     URL="${2:-}";     shift; [ $# -gt 0 ] && shift ;;
    --host)    HOST="${2:-}";    shift; [ $# -gt 0 ] && shift ;;
    --sha)     SHA_ATTENDU="${2:-}"; shift; [ $# -gt 0 ] && shift ;;
    --attendu) ATTENDU="${2:-}"; shift; [ $# -gt 0 ] && shift ;;
    --menu|-h|--help) afficher_menu; exit 0 ;;
    *)
      echo "Option inconnue : $1" >&2
      afficher_menu >&2
      exit 2
      ;;
  esac
done

# URL de base : retire un eventuel slash final, retombe sur la valeur par defaut
URL="${URL%/}"
[ -n "$URL" ] || URL="http://192.168.1.51:30090"

# --- verification des dependances -------------------------------------------
for outil in curl sha256sum grep sed awk tr; do
  if ! command -v "$outil" >/dev/null 2>&1; then
    echo "Dependance manquante : $outil" >&2
    exit 2
  fi
done

# --- en-tete Host eventuel --------------------------------------------------
H_OPTS=()
if [ -n "$HOST" ]; then
  H_OPTS=(-H "Host: $HOST")
fi

# --- utilitaires ------------------------------------------------------------
# requete : curl silencieux avec delais courts, en-tete Host inclus
requete() {
  curl -s --connect-timeout 5 --max-time 20 "${H_OPTS[@]}" "$@"
}

# tronque : limite une valeur a 18 caracteres pour tenir dans le tableau
tronque() {
  local s="$1"
  if [ "${#s}" -gt 18 ]; then
    printf '%s..' "${s:0:16}"
  else
    printf '%s' "$s"
  fi
}

# verifier : affiche une ligne du tableau et met a jour les compteurs
# $1 = etat (OK/KO/IGN), $2 = nom du controle, $3 = attendu, $4 = obtenu,
# $5 = chemin teste
verifier() {
  local etat="$1" nom="$2" att="$3" obt="$4" chemin="$5"
  case "$etat" in
    OK)  OK_NB=$((OK_NB + 1)) ;;
    KO)  KO_NB=$((KO_NB + 1))
         ECHECS="$ECHECS
  - $nom ($chemin) : attendu [$att] / obtenu [$obt]" ;;
    IGN) IGN_NB=$((IGN_NB + 1)) ;;
  esac
  printf '%-4s %-34s %-18s %-18s\n' "$etat" "$nom" "$(tronque "$att")" "$(tronque "$obt")"
}

# controle_code : meme controle HTTP pour tous les chemins
# $1 = nom, $2 = chemin, $3 = code attendu
controle_code() {
  local nom="$1" chemin="$2" att="$3" code
  code=$(requete -o /dev/null -w '%{http_code}' "$URL$chemin")
  [ -n "$code" ] || code="(aucune)"
  if [ "$code" = "$att" ]; then
    verifier OK "$nom" "$att" "$code" "$chemin"
  else
    verifier KO "$nom" "$att" "$code" "$chemin"
  fi
}

# --- en-tete du rapport -----------------------------------------------------
echo "Verification du dashboard Hakko (k3s)"
echo "Cible : $URL"
if [ -n "$HOST" ]; then
  echo "En-tete Host envoye : $HOST"
else
  echo "En-tete Host envoye : (aucun)"
fi
echo
printf '%-4s %-34s %-18s %-18s\n' "ETAT" "CONTROLE" "ATTENDU" "OBTENU"
awk 'BEGIN { for (i = 0; i < 77; i++) printf "-"; print "" }'

# --- 1. pages servies en HTTP 200 -------------------------------------------
controle_code "HTTP /"                     "/"                     200
controle_code "HTTP /hakko-dashboard.html" "/hakko-dashboard.html" 200
controle_code "HTTP /index.html"           "/index.html"           200
controle_code "HTTP /README.md"            "/README.md"            200

# --- 2. endpoint de sante /healthz (corps exactement "ok") ------------------
corps_healthz=$(requete "$URL/healthz" | tr -d '\r\n\t ')
[ -n "$corps_healthz" ] || corps_healthz="(vide)"
if [ "$corps_healthz" = "ok" ]; then
  verifier OK "Corps /healthz" "ok" "$corps_healthz" "/healthz"
else
  verifier KO "Corps /healthz" "ok" "$corps_healthz" "/healthz"
fi

# --- 3. chaine attendue presente dans index.html ----------------------------
corps_index=$(requete "$URL/index.html")
if printf '%s' "$corps_index" | grep -q -F -e "$ATTENDU"; then
  verifier OK "Chaine dans /index.html" "\"$ATTENDU\"" "presente" "/index.html"
else
  verifier KO "Chaine dans /index.html" "\"$ATTENDU\"" "absente" "/index.html"
fi

# --- 4. empreinte sha256 du dashboard (si --sha fourni) ---------------------
if [ -n "$SHA_ATTENDU" ]; then
  sha_obtenu=$(requete "$URL/hakko-dashboard.html" | sha256sum | awk '{ print $1 }')
  [ -n "$sha_obtenu" ] || sha_obtenu="(aucune)"
  if [ "$sha_obtenu" = "$SHA_ATTENDU" ]; then
    verifier OK "sha256 /hakko-dashboard.html" "$SHA_ATTENDU" "$sha_obtenu" "/hakko-dashboard.html"
  else
    verifier KO "sha256 /hakko-dashboard.html" "$SHA_ATTENDU" "$sha_obtenu" "/hakko-dashboard.html"
  fi
else
  verifier IGN "sha256 /hakko-dashboard.html" "sha identique" "(non fourni)" "/hakko-dashboard.html"
fi

# --- 5. fichier de mots de passe absent (404) -------------------------------
controle_code "HTTP /TimServer.md (absent)" "/TimServer.md" 404

# --- 6. sous-dossiers de livraison accessibles ------------------------------
controle_code "HTTP /_build/RAPPORT-FINAL.md" "/_build/RAPPORT-FINAL.md" 200
controle_code "HTTP /_verify/RAPPORT.md"      "/_verify/RAPPORT.md"      200

# --- 7. Content-Type de /README.md ------------------------------------------
ctype=$(requete -D - -o /dev/null "$URL/README.md" \
  | grep -i -m 1 '^content-type:' \
  | sed -e 's/^[^:]*:[[:space:]]*//' -e 's/\r$//')
[ -n "$ctype" ] || ctype="(absent)"
ctype_min=$(printf '%s' "$ctype" | tr 'A-Z' 'a-z')
case "$ctype_min" in
  *"text/markdown"*) verifier OK "Entete /README.md" "text/markdown" "$ctype" "/README.md" ;;
  *)                 verifier KO "Entete /README.md" "text/markdown" "$ctype" "/README.md" ;;
esac

# --- 8. racine joignable via l'Ingress (si --host fourni) -------------------
if [ -n "$HOST" ]; then
  code_ingress=$(requete -o /dev/null -w '%{http_code}' "$URL/")
  [ -n "$code_ingress" ] || code_ingress="(aucune)"
  if [ "$code_ingress" = "200" ]; then
    verifier OK "Ingress / via Host" 200 "$code_ingress" "/"
  else
    verifier KO "Ingress / via Host" 200 "$code_ingress" "/"
  fi
else
  verifier IGN "Ingress / via Host" 200 "(non fourni)" "/"
fi

# --- recapitulatif ----------------------------------------------------------
echo
printf '%s controles · %s OK · %s KO' "$((OK_NB + KO_NB))" "$OK_NB" "$KO_NB"
if [ "$IGN_NB" -gt 0 ]; then
  printf ' · %s ignore(s)' "$IGN_NB"
fi
printf '\n'

if [ "$KO_NB" -eq 0 ]; then
  echo "VERDICT : SUCCES - tous les controles passent sur $URL"
  exit 0
else
  echo "VERDICT : ECHEC - $KO_NB controle(s) en echec sur $URL"
  echo "Details des echecs :$ECHECS"
  exit 1
fi
