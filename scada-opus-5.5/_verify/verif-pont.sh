#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# verif-pont.sh - verification du "pont" Home Assistant du dashboard
#                Scada-opus-5.5.
#
# Le pont est le service qui repond sous /api/ sur la meme origine que le
# dashboard (nginx fait proxy_pass vers 127.0.0.1:8080), garde le jeton Home
# Assistant cote serveur et commande les 5 prises de la multiprise.
#
# Ce script ne fait que des appels HTTP (GET, et POST uniquement si l'option
# --ecriture est donnee) : il n'ecrit aucun fichier, aucun dossier temporaire.
#
# Usage :
#   bash verif-pont.sh [options]
#   chmod +x verif-pont.sh && ./verif-pont.sh [options]
#
# Codes de sortie : 0 = tous les controles passent, 1 = au moins un KO,
#                   2 = erreur d'usage ou outil manquant.
#
# Dependances : curl, grep, sed, awk, tr, sort, uniq (outils standard seulement).
#               Pas de python : python3 n'existe pas sur ce poste et la
#               validation JSON reste volontairement sommaire.
# Fins de ligne LF. Pas de "set -e" : chaque echec est compte, jamais masque.
# ---------------------------------------------------------------------------

# --- valeurs par defaut -----------------------------------------------------
URL="http://192.168.1.51:30090"
JETON=""
NB_PRISES=5
NB_SONDES=4
ECRITURE=0

# Entite volontairement hors de la liste blanche des 5 prises du pont : le
# pont doit repondre 403, la requete est donc sans effet.
ENTITE_HORS_LISTE="sensor.sonde_sonoff_1_temperature"
# Corps volontairement invalide : le champ "allume" manque -> 400.
CORPS_INVALIDE='{"entite":"x"}'

# --- compteurs globaux ------------------------------------------------------
OK_NB=0
KO_NB=0
IGN_NB=0
ECHECS=""

# --- aide -------------------------------------------------------------------
afficher_menu() {
  cat <<'FIN_AIDE'
verif-pont.sh - verification du pont Home Assistant du dashboard Scada-opus-5.5

Usage :
  bash verif-pont.sh [options]
  chmod +x verif-pont.sh && ./verif-pont.sh [options]

Options :
  --url <base>        URL de base du service, ex. http://127.0.0.1:8080
                      (defaut : http://192.168.1.51:30090, le NodePort)
  --jeton <jeton>     jeton envoye en "Authorization: Bearer <jeton>".
                      Defaut : aucun en-tete. Les controles 1 et 4 sont
                      toujours envoyes SANS en-tete Authorization.
  --prises <n>        nombre minimal de prises (domaine "switch") attendues
                      dans /api/etat (defaut : 5)
  --sondes <n>        nombre minimal de sondes (domaine "sensor") attendues
                      dans /api/etat (defaut : 4)
  --ecriture          autorise UN SEUL POST reel : le controle 8 envoie
                      allume=false sur une prise deja eteinte, puis relit
                      /api/etat et verifie que son etat reste "off".
  9. POST /api/prise avec Content-Type text/plain -> 415 (requete « simple »,
     sans pre-vol CORS : c'est le vecteur CSRF a fermer)
 10. POST /api/prise avec une Origin etrangere -> 403 (defense contre le DNS
     rebinding ; conditionnel : necessite --jeton)
                      Sans cette option, aucun POST n'est envoye vers
                      /api/prise (controle 7 ignore).
  -h, --help          affiche cette aide

Controles :
  1. GET  /api/sante -> 200, corps exactement "ok", sans en-tete Authorization
  2. GET  /api/etat  -> 200, JSON sommaire valide, au moins --prises entites
                        de domaine switch et --sondes de domaine sensor
  3. chaque prise declaree porte un champ etat parmi
     on / off / unavailable / unknown
  4. si --jeton est fourni : le meme GET SANS en-tete -> 401
  5. POST /api/prise avec une entite hors liste blanche
     (sensor.sonde_sonoff_1_temperature) -> 403
  6. POST /api/prise avec un corps invalide ({"entite":"x"}) -> 400
  7. POST /api/prise valide sans --ecriture -> ignore, aucun POST envoye
  8. avec --ecriture : POST allume=false sur une prise deja eteinte, puis
     relecture de /api/etat : son etat doit rester "off"

  Le script n'envoie JAMAIS allume=true : tout corps contenant
  "allume":true est refuse avant l'envoi (code de sortie 2).

Sortie :
  Un tableau (n, controle, attendu, obtenu, OK/KO/IGN), le total des controles
  puis la liste detaillee des echecs. Les libelles sont sans accent : printf
  compte les octets, un accent decalerait les colonnes.

Codes de sortie :
  0 = tous les controles passent
  1 = au moins un controle en echec
  2 = erreur d'usage ou outil manquant

Dependances : curl, grep, sed, awk, tr, sort, uniq. Aucun fichier temporaire.
FIN_AIDE
}

# --- analyse des arguments --------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --url)
      if [ $# -lt 2 ] || [ -z "$2" ]; then
        echo "Option --url : valeur manquante" >&2
        exit 2
      fi
      URL="$2"; shift 2 ;;
    --jeton)
      if [ $# -lt 2 ]; then
        echo "Option --jeton : valeur manquante" >&2
        exit 2
      fi
      JETON="$2"; shift 2 ;;
    --prises)
      if [ $# -lt 2 ] || [ -z "$2" ]; then
        echo "Option --prises : valeur manquante" >&2
        exit 2
      fi
      NB_PRISES="$2"; shift 2 ;;
    --sondes)
      if [ $# -lt 2 ] || [ -z "$2" ]; then
        echo "Option --sondes : valeur manquante" >&2
        exit 2
      fi
      NB_SONDES="$2"; shift 2 ;;
    --ecriture)
      ECRITURE=1; shift ;;
    -h|--help)
      afficher_menu; exit 0 ;;
    *)
      echo "Option inconnue : $1" >&2
      echo >&2
      afficher_menu >&2
      exit 2 ;;
  esac
done

# --- validation des arguments ----------------------------------------------
URL="${URL%/}"
case "$URL" in
  http://|https://|'')
    echo "Option --url : URL invalide (hote manquant) : \"$URL\"" >&2
    exit 2 ;;
  http://*|https://*) ;;
  *)
    echo "Option --url : URL invalide (http:// ou https:// attendu) : \"$URL\"" >&2
    exit 2 ;;
esac

case "$NB_PRISES" in
  ''|*[!0-9]*)
    echo "Option --prises : entier positif attendu (recu : \"$NB_PRISES\")" >&2
    exit 2 ;;
esac
case "$NB_SONDES" in
  ''|*[!0-9]*)
    echo "Option --sondes : entier positif attendu (recu : \"$NB_SONDES\")" >&2
    exit 2 ;;
esac

# --- verification des dependances ------------------------------------------
for outil in curl grep sed awk tr sort uniq; do
  if ! command -v "$outil" >/dev/null 2>&1; then
    echo "Dependance manquante : $outil" >&2
    exit 2
  fi
done

# --- aucun fichier temporaire -----------------------------------------------
# Aucun fichier temporaire n'est necessaire : le code HTTP est capture sur la
# sortie standard de curl (-w) et le corps dans la meme variable shell.
# C'est volontaire : sur ce poste (git-bash MSYS) mktemp -d renvoie un chemin
# MSYS (/tmp/...) que le curl natif mingw ne sait pas ouvrir (-o echoue en
# code 23). Ne pas reintroduire de -o vers un chemin MSYS.

# --- en-tete d'authentification --------------------------------------------
# Tableau vide = aucun argument ajoute a la ligne de commande curl.
OPTS_AUTH=()
if [ -n "$JETON" ]; then
  OPTS_AUTH=(-H "Authorization: Bearer $JETON")
fi

# --- utilitaires ------------------------------------------------------------
# norm_code : vide ou 000 (connexion impossible) -> "(aucune)"
norm_code() {
  case "$1" in
    ''|000) printf '(aucune)' ;;
    *)      printf '%s' "$1" ;;
  esac
}

# tronque : limite une valeur a $2 caracteres pour tenir dans le tableau
tronque() {
  local s="$1" max="${2:-24}"
  if [ "${#s}" -gt "$max" ]; then
    printf '%s..' "${s:0:$((max - 2))}"
  else
    printf '%s' "$s"
  fi
}

# requetes HTTP : delais courts, sortie silencieuse.
# Chaque fonction renvoie "corps<retour a la ligne><code HTTP>" sur stdout :
# le code est la DERNIERE ligne, le corps tout ce qui precede.
corps_sans_auth() {
  curl -s --connect-timeout 5 --max-time 20 -w '\n%{http_code}' "$URL$1"
}
corps_avec_auth() {
  curl -s --connect-timeout 5 --max-time 20 "${OPTS_AUTH[@]}" \
    -w '\n%{http_code}' "$URL$1"
}
code_de() {   # $1 = reponse "corps\n<code>" -> code seul (normalise)
  norm_code "${1##*$'\n'}"
}
corps_de() {  # $1 = reponse "corps\n<code>" -> corps seul
  printf '%s' "${1%$'\n'*}"
}

# post_prise : POST /api/prise. Renvoie "corps\n<code>" sur stdout.
# GARDE-FOU : refuse tout corps contenant "allume":true (jamais d'allumage).
post_prise() {
  local corps="$1"
  case "$corps" in
    *'"allume":true'*|*'"allume" : true'*|*'"allume": true'*)
      echo "REFUS : ce script n'envoie jamais allume=true." >&2
      exit 2 ;;
  esac
  curl -s --connect-timeout 5 --max-time 20 -X POST \
    "${OPTS_AUTH[@]}" \
    -H 'Content-Type: application/json' \
    --data-binary "$corps" \
    -w '\n%{http_code}' "$URL/api/prise"
}

# objets_json : un objet JSON par ligne, enumerateur remis a zero
# - les sauts de ligne sont d'abord retires (JSON compact ou indente) ;
# - un saut de ligne est insere a chaque frontiere "},{", ce qui separe les
#   elements de "appareils" (heuristique, suffisante pour ce contrat) ;
# - les espaces autour de ':' et ',' sont retires, les motifs ci-dessous ne
#   dependent donc plus de la mise en forme du pont.
objets_json() {
  tr -d '\r\n' \
    | awk '{ gsub(/}[[:space:]]*,[[:space:]]*\{/, "}\n{"); print }' \
    | sed -e 's/[[:space:]]*:[[:space:]]*/:/g' -e 's/[[:space:]]*,[[:space:]]*/,/g'
}

# extrait_entite / extrait_etat : valeur des champs "entite" / "etat" de chaque
# ligne normalisee ("entite":" fait 10 caracteres, "etat":" en fait 8).
# Sans "exit" : utilises en filtre sur plusieurs lignes (comptage, doublons).
extrait_entite() {
  awk 'match($0, /"entite":"[^"]*"/) { print substr($0, RSTART + 10, RLENGTH - 11) }'
}
extrait_etat() {
  awk 'match($0, /"etat":"[^"]*"/) { print substr($0, RSTART + 8, RLENGTH - 9) }'
}

# premier : ne garde que la premiere ligne (premiere occurrence d'une entite)
premier() {
  awk 'NR == 1 { print; exit }'
}

# entites_domaine : nombre d'entites DISTINCTES de domaine $2 dans le corps $1
entites_domaine() {
  printf '%s' "$1" | objets_json \
    | grep -F "\"domaine\":\"$2\"" \
    | extrait_entite \
    | sort -u \
    | awk 'END { print NR + 0 }'
}

# etat_de : valeur du champ "etat" de l'entite $2 dans le corps $1
etat_de() {
  printf '%s' "$1" | objets_json \
    | grep -F "\"entite\":\"$2\"" \
    | extrait_etat \
    | premier
}

# trouver_prise_eteinte : premiere prise de domaine switch dont l'etat est
# deja "off" - seule cible d'ecriture toleree par ce script.
trouver_prise_eteinte() {
  printf '%s' "$1" | objets_json \
    | grep -F '"domaine":"switch"' \
    | grep -F '"etat":"off"' \
    | extrait_entite \
    | premier
}

# verifier : affiche une ligne du tableau et met a jour les compteurs.
# $1 = numero, $2 = etat (OK/KO/IGN), $3 = libelle, $4 = attendu,
# $5 = obtenu, $6 = chemin teste, $7 = detail facultatif (liste des echecs)
verifier() {
  local num="$1" etat="$2" nom="$3" att="$4" obt="$5" chemin="$6" detail="${7:-}" suffixe=""
  case "$etat" in
    OK)  OK_NB=$((OK_NB + 1)) ;;
    KO)  KO_NB=$((KO_NB + 1))
         [ -n "$detail" ] && suffixe=" ($detail)"
         ECHECS="$ECHECS
  - [$num] $nom ($chemin) : attendu [$att] / obtenu [$obt]$suffixe" ;;
    IGN) IGN_NB=$((IGN_NB + 1)) ;;
  esac
  printf '%-3s %-32s %-24s %-24s %s\n' \
    "$num" "$nom" "$(tronque "$att" 24)" "$(tronque "$obt" 24)" "$etat"
}

# --- en-tete du rapport -----------------------------------------------------
echo "Verification du pont Home Assistant (dashboard Scada-opus-5.5)"
echo "Cible : $URL"
if [ -n "$JETON" ]; then
  echo "Jeton : fourni (en-tete Authorization: Bearer ...)"
else
  echo "Jeton : aucun (appels sans en-tete Authorization)"
fi
echo "Seuils : --prises $NB_PRISES prise(s), --sondes $NB_SONDES sonde(s)"
if [ "$ECRITURE" -eq 1 ]; then
  echo "Ecriture : autorisee (controle 8 uniquement, allume=false)"
else
  echo "Ecriture : interdite (aucun POST valide envoye)"
fi
echo
printf '%-3s %-32s %-24s %-24s %s\n' "N" "CONTROLE" "ATTENDU" "OBTENU" "ETAT"
awk 'BEGIN { for (i = 0; i < 91; i++) printf "-"; print "" }'

# --- 1. /api/sante : 200 et corps exactement "ok", sans authentification ----
rep_1=$(corps_sans_auth /api/sante)
code_1=$(code_de "$rep_1")
corps_1=$(corps_de "$rep_1" | tr -d '\r\n\t ')
[ -n "$corps_1" ] || corps_1="(vide)"
att_1='200 "ok"'
obt_1="$code_1 \"$corps_1\""
if [ "$code_1" = "200" ] && [ "$corps_1" = "ok" ]; then
  verifier 1 OK "Sante /api/sante (sans jeton)" "$att_1" "$obt_1" /api/sante
else
  verifier 1 KO "Sante /api/sante (sans jeton)" "$att_1" "$obt_1" /api/sante \
    "corps attendu exactement ok (sans retour ligne), sans en-tete Authorization"
fi

# --- 2. /api/etat : 200, JSON sommaire valide, entites switch et sensor -----
rep_2=$(corps_avec_auth /api/etat)
code_2=$(code_de "$rep_2")
CORPS_2=$(corps_de "$rep_2" | tr -d '\r')
CORPS_PLAT=$(printf '%s' "$CORPS_2" | tr -d ' \t\r\n')

souci_2=""
CORPS_NET=$(printf '%s' "$CORPS_2" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
case "$CORPS_NET" in
  '{'*'}') ;;
  *) souci_2="$souci_2 objet-absent" ;;
esac
printf '%s' "$CORPS_PLAT" | grep -q -F '"ok":true' || souci_2="$souci_2 ok:true-absent"
printf '%s' "$CORPS_PLAT" | grep -q -E '"horodatage":[0-9]+' \
  || souci_2="$souci_2 horodatage-non-numerique"
printf '%s' "$CORPS_PLAT" | grep -q -F '"appareils":[' \
  || souci_2="$souci_2 appareils-absent"
equilibre_2=$(printf '%s' "$CORPS_PLAT" | awk '
  { o += gsub(/\{/, ""); f += gsub(/\}/, ""); c += gsub(/\[/, ""); d += gsub(/\]/, "") }
  END { if (o == f && c == d) print "oui"; else print "non" }')
[ "$equilibre_2" = "oui" ] || souci_2="$souci_2 delimiteurs-desequilibres"

nb_switch=$(entites_domaine "$CORPS_2" switch)
nb_sensor=$(entites_domaine "$CORPS_2" sensor)
[ -n "$nb_switch" ] || nb_switch=0
[ -n "$nb_sensor" ] || nb_sensor=0
if [ "$nb_switch" -lt "$NB_PRISES" ]; then
  souci_2="$souci_2 switch=$nb_switch<$NB_PRISES"
fi
if [ "$nb_sensor" -lt "$NB_SONDES" ]; then
  souci_2="$souci_2 sensor=$nb_sensor<$NB_SONDES"
fi

if [ -z "$souci_2" ]; then etat_json_2="ok"; else etat_json_2="faux"; fi
att_2="200 JSON sw>=$NB_PRISES se>=$NB_SONDES"
obt_2="$code_2 JSON=$etat_json_2 sw=$nb_switch se=$nb_sensor"
detail_2="$souci_2"
if [ "$code_2" = "401" ] && [ -z "$JETON" ]; then
  detail_2="$detail_2 ; 401 : le pont exige un jeton (relancer avec --jeton)"
fi
if [ "$code_2" = "200" ] && [ -z "$souci_2" ]; then
  verifier 2 OK "Etat /api/etat : JSON et entites" "$att_2" "$obt_2" /api/etat
else
  verifier 2 KO "Etat /api/etat : JSON et entites" "$att_2" "$obt_2" /api/etat \
    "manquants :$detail_2"
fi

# remarque non bloquante : entite declaree deux fois dans "appareils"
doublons=$(printf '%s' "$CORPS_2" | objets_json | extrait_entite | sort | uniq -d | tr '\n' ' ')
doublons=$(printf '%s' "$doublons" | sed -e 's/[[:space:]]*$//')

# --- 3. chaque prise porte un champ etat parmi la liste autorisee -----------
prise_ok=$(printf '%s' "$CORPS_2" | objets_json \
  | grep -F '"domaine":"switch"' \
  | awk '{ n++; if ($0 ~ /"etat":"(on|off|unavailable|unknown)"/) o++ } \
         END { printf "%d/%d", o + 0, n + 0 }')
prise_tot=${prise_ok#*/}
att_3="toutes avec etat"
if [ "$prise_tot" -eq 0 ] 2>/dev/null; then
  verifier 3 IGN "Etat de chaque prise" "$att_3" "(aucune prise)" /api/etat \
    "aucune entite de domaine switch trouvee (voir controle 2)"
elif [ "${prise_ok%%/*}" = "$prise_tot" ]; then
  verifier 3 OK "Etat de chaque prise" "$att_3" "$prise_ok" /api/etat
else
  verifier 3 KO "Etat de chaque prise" "$att_3" "$prise_ok" /api/etat \
    "champs etat attendus : on, off, unavailable ou unknown"
fi

# --- 4. sans en-tete Authorization : 401 (si --jeton est fourni) ------------
if [ -n "$JETON" ]; then
  code_4=$(code_de "$(corps_sans_auth /api/etat)")
  if [ "$code_4" = "401" ]; then
    verifier 4 OK "Sans jeton : acces refuse" 401 "$code_4" /api/etat
  else
    verifier 4 KO "Sans jeton : acces refuse" 401 "$code_4" /api/etat \
      "sans en-tete Authorization le pont doit repondre 401"
  fi
else
  verifier 4 IGN "Sans jeton : acces refuse" 401 "(aucun --jeton)" /api/etat \
    "controle conditionnel : fournir --jeton pour le declencher"
fi

# --- 5. entite hors liste blanche -> 403 ------------------------------------
CORPS_HORS_LISTE=$(printf '{"entite":"%s","allume":false}' "$ENTITE_HORS_LISTE")
code_5=$(code_de "$(post_prise "$CORPS_HORS_LISTE")")
att_5="403 hors liste blanche"
if [ "$code_5" = "403" ]; then
  verifier 5 OK "POST hors liste blanche" "$att_5" "$code_5" /api/prise
else
  verifier 5 KO "POST hors liste blanche" "$att_5" "$code_5" /api/prise \
    "entite $ENTITE_HORS_LISTE refusee attendue (403)"
fi

# --- 6. corps invalide -> 400 -----------------------------------------------
code_6=$(code_de "$(post_prise "$CORPS_INVALIDE")")
att_6="400 corps invalide"
if [ "$code_6" = "400" ]; then
  verifier 6 OK "POST corps invalide" "$att_6" "$code_6" /api/prise
else
  verifier 6 KO "POST corps invalide" "$att_6" "$code_6" /api/prise \
    "corps $CORPS_INVALIDE refuse attendu (400)"
fi

# --- 7. POST valide sans --ecriture : ignore, aucun POST n'est envoye -------
if [ "$ECRITURE" -eq 1 ]; then
  verifier 7 IGN "POST valide sans --ecriture" \
    "aucun POST a l'aveugle" "couvert par le 8" /api/prise
else
  verifier 7 IGN "POST valide sans --ecriture" \
    "aucun POST a l'aveugle" "aucun POST envoye" /api/prise
fi

# --- 8. avec --ecriture : allume=false sur une prise deja eteinte -----------
# Jamais allume=true. On ne touche qu'une prise dont l'etat courant est "off" :
# la requete est idempotente, elle ne peut rien allumer.
if [ "$ECRITURE" -ne 1 ]; then
  verifier 8 IGN "Ecriture allume=false" "allume=false, etat off" \
    "(sans --ecriture)" /api/prise \
    "relancer avec --ecriture pour le seul test d'ecriture reel"
else
  prise_8=$(trouver_prise_eteinte "$CORPS_2")
  if [ -z "$prise_8" ]; then
    verifier 8 IGN "Ecriture allume=false" "allume=false, etat off" \
      "(aucune prise off)" /api/prise \
      "aucune prise deja eteinte trouvee : aucun POST envoye par securite"
  else
    CORPS_8=$(printf '{"entite":"%s","allume":false}' "$prise_8")
    code_8=$(code_de "$(post_prise "$CORPS_8")")
    rep_8=$(corps_avec_auth /api/etat)
    CORPS_8_RELECTURE=$(corps_de "$rep_8" | tr -d '\r')
    etat_apres_8=$(etat_de "$CORPS_8_RELECTURE" "$prise_8")
    [ -n "$etat_apres_8" ] || etat_apres_8="(absent)"
    att_8="allume=false, etat off"
    obt_8="$code_8 puis etat=$etat_apres_8"
    if [ "$code_8" = "200" ] && [ "$etat_apres_8" = "off" ]; then
      verifier 8 OK "Ecriture allume=false" "$att_8" "$obt_8" /api/prise
    else
      verifier 8 KO "Ecriture allume=false" "$att_8" "$obt_8" /api/prise \
        "POST allume=false sur $prise_8 : reponse $code_8, etat relu $etat_apres_8"
    fi
  fi
fi

# --- 9. Content-Type simple (text/plain) -> 415 ----------------------------
# Une page hostile peut envoyer un POST sans pre-vol CORS des lors que le corps est
# en text/plain : le pont doit refuser tout autre type que application/json.
# Le corps envoye ici n'allume jamais rien (allume=false).
if [ -n "$JETON" ]; then
  CORPS_9=$(printf '{"entite":"%s","allume":false}' "$ENTITE_HORS_LISTE")
  code_9=$(curl -s --connect-timeout 5 --max-time 20 -o /dev/null -w '%{http_code}' \
    -X POST "$URL/api/prise" "${OPTS_AUTH[@]}" \
    -H 'Content-Type: text/plain' --data "$CORPS_9" | tr -d '\r')
  att_9="415 type refuse"
  if [ "$code_9" = "415" ]; then
    verifier 9 OK "POST text/plain refuse (CSRF)" "$att_9" "$code_9" /api/prise
  else
    verifier 9 KO "POST text/plain refuse (CSRF)" "$att_9" "$code_9" /api/prise \
      "un corps text/plain echappe au pre-vol CORS : il doit etre refuse (415)"
  fi
else
  verifier 9 IGN "POST text/plain refuse (CSRF)" "415 type refuse" "(aucun --jeton)" /api/prise \
    "controle conditionnel : fournir --jeton pour le declencher"
fi

# --- 10. Origin etrangere -> 403 --------------------------------------------
# Defense en profondeur contre le DNS rebinding et l'appel depuis un autre site.
# Meme remarque : allume=false, aucune ecriture reelle.
if [ -n "$JETON" ]; then
  CORPS_10=$(printf '{"entite":"%s","allume":false}' "$ENTITE_HORS_LISTE")
  code_10=$(curl -s --connect-timeout 5 --max-time 20 -o /dev/null -w '%{http_code}' \
    -X POST "$URL/api/prise" "${OPTS_AUTH[@]}" \
    -H 'Content-Type: application/json' -H 'Origin: http://evil.example' \
    --data "$CORPS_10" | tr -d '\r')
  att_10="403 origine refusee"
  if [ "$code_10" = "403" ]; then
    verifier 10 OK "POST depuis une autre origine" "$att_10" "$code_10" /api/prise
  else
    verifier 10 KO "POST depuis une autre origine" "$att_10" "$code_10" /api/prise \
      "une origine differente de l'hote appele doit etre refusee (403)"
  fi
else
  verifier 10 IGN "POST depuis une autre origine" "403 origine refusee" "(aucun --jeton)" /api/prise \
    "controle conditionnel : fournir --jeton pour le declencher"
fi

# --- recapitulatif ----------------------------------------------------------
TOTAL=$((OK_NB + KO_NB + IGN_NB))
echo
echo "Total : $TOTAL controles | $OK_NB OK | $KO_NB KO | $IGN_NB ignore(s)"
if [ -n "$doublons" ]; then
  echo "Remarque : entite(s) presente(s) plusieurs fois dans appareils : $doublons"
fi

if [ "$KO_NB" -eq 0 ]; then
  echo "VERDICT : SUCCES - les $OK_NB controles actifs passent sur $URL"
  exit 0
else
  echo "VERDICT : ECHEC - $KO_NB controle(s) en echec sur $URL"
  echo "Details des echecs :$ECHECS"
  exit 1
fi
