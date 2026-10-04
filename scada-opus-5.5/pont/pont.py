#!/usr/bin/env python3
"""Pont entre le dashboard « Scada-opus-5.5 » et l'API REST de Home Assistant.

Pourquoi ce service existe : un navigateur ne peut pas appeler Home Assistant
directement (l'API ne renvoie aucun en-tête CORS, mesuré), et le jeton d'accès ne
doit jamais se retrouver dans une page. Le pont tourne donc dans le même pod que
nginx, écoute sur la boucle locale du pod — donc n'est atteint que par nginx, sur la
même origine que le dashboard (/api/…) : ni CORS, ni jeton côté client.

Configuration par variables d'environnement :

  HASS_URL        URL de base de Home Assistant, ex. http://192.168.1.51:8123
  HASS_TOKEN      jeton d'accès longue durée (jamais journalisé, jamais renvoyé)
  PONT_JETON      secret partagé exigé sur /api/etat et /api/prise quand
                  PONT_AUTH=jeton (défaut) : au moins 32 caractères. Sans lui,
                  n'importe quel appareil du réseau pourrait commander les prises.
  PONT_AUTH       « jeton » (défaut) : authentification exigée, refus de démarrer
                  sans jeton. « aucune » : le dashboard ne demande rien ; les gardes
                  d'origine et de type de contenu restent appliquées (une page
                  hostile ne peut pas commander), mais toute machine du réseau
                  local le peut — c'est un choix d'installation, jamais un défaut.
  PONT_PRISES     liste blanche des prises commandables, séparées par des virgules
  PONT_SONDES     appareils de mesure remontés, séparés par des virgules
  PONT_BATTERIES  correspondance « mesure=batterie », séparée par des virgules
  PONT_ADRESSE    adresse d'écoute (défaut 127.0.0.1 : boucle locale du pod)
  PONT_PORT       port d'écoute (défaut 8080)
  PONT_CHAUFFE_MAX  durée maximale, en minutes, d'une chauffe commandée par la
                  régulation automatique : passé ce délai, le pont coupe lui-même la
                  prise. Défaut 90, 0 = surveillance désactivée. La page qui a
                  commandé peut disparaître (onglet fermé, réseau coupé), le pont
                  non : c'est lui qui garantit l'arrêt.
  PONT_DONNEES    répertoire des magasins partagés : le document versionné
                  (donnees.json), sa génération précédente, le sceau d'installation
                  (semence.json) et la trace des décisions (decisions.jsonl). Non
                  donné, il est déduit de PONT_ETAT — c'est le même volume
                  persistant. Vide, le partage de données n'est pas servi (503).

Bibliothèque standard uniquement : aucune dépendance à installer.
"""

import contextlib
import datetime
import hmac
import json
import math
import os
import secrets
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DELAI_HA = 8.0              # secondes, par opération de socket vers Home Assistant
DELAI_CLIENT = 10.0         # secondes : un client qui n'envoie pas son corps est coupé
CORPS_MAX = 4096            # octets, taille maximale acceptée sur /api/prise
CACHE_ETAT = 2.0            # secondes, pour ne pas marteler Home Assistant
APPELS_SIMULTANES = 4       # appels à Home Assistant en parallèle, au maximum
JETON_MIN = 32              # caractères ; en dessous, refus de démarrer

# --- Magasin « donnees » : le document partagé, versionné (protocole v2 §2.C et §3) ---
# Clés racine acceptées, liste close : tout le reste est refusé à l'écriture, parce
# qu'une clé inconnue serait stockée sans que personne sache qui la lit.
CLES_RACINE = ("recettes", "lots", "appareils", "reglages")
# 512 Kio, et non 2 Mio : nginx plafonne à 1 Mio par défaut, le pont est limité à
# 64 Mi de mémoire, et le volume fait 8 Mi — or une écriture atomique avec copie
# précédente demande trois fois la taille du document.
DOCUMENT_MAX = 512 * 1024
# Corps accepté sur /api/donnees, enveloppe comprise : aligné sur le
# « client_max_body_size 528k » exigé de nginx. CORPS_MAX reste celui de /api/prise.
CORPS_DONNEES_MAX = 528 * 1024
# Magasin « decisions » : append-only, tourné, une génération conservée.
DECISIONS_FICHIER_MAX = 256 * 1024
DECISIONS_SERVIES_MAX = 500
# Idempotence : les seize derniers « op » appliqués. Sans eux, un POST qui aboutit
# mais dont la réponse est perdue au-delà du proxy_read_timeout est rejoué, reçoit un
# 409, et l'utilisateur se voit proposer d'adopter ce qu'il vient d'écrire.
OPS_RETENUS = 16
# Lots dont une réactivation a été refusée (§4.4). Un lot supprimé du document garde
# sa quarantaine : s'il revient, il reste hors du plan jusqu'à confirmation.
QUARANTAINE_MAX = 512
# Dernier « maj » retenu par lot, y compris pour les lots supprimés : c'est ce souvenir
# qui empêche un appareil périmé de ressusciter un lot effacé et de rallumer sa prise.
# Plafonné pour que la mémoire ne croisse pas sans fin ; les plus récents sont gardés.
MAJS_MAX = 2048
VERROU_PERIME = 30.0        # secondes : au-delà, le détenteur est tenu pour disparu
VERROU_ATTENTE = 5.0        # secondes d'attente avant de rendre la main au client
# Au-delà de ce délai d'illisibilité du document, le pont cesse de repousser
# l'échéance de sécurité : le plafond de chauffe coupe de lui-même (§4.5).
# Valeur posée par analogie avec la cadence de redépôt de l'ancienne page, non mesurée.
DOCUMENT_ILLISIBLE_MAX = 600


def liste(valeur):
    return [x.strip() for x in (valeur or "").split(",") if x.strip()]


def sans_port_defaut(hote, scheme):
    """Retire le port par défaut (80 en http, 443 en https) d'un « hote[:port] ».

    Le navigateur écrit « http://hote » (sans port) là où l'en-tête Host porte
    parfois « hote:80 » : sans cette normalisation, une requête parfaitement
    légitime serait refusée comme une origine étrangère.
    """
    h = (hote or "").strip()
    defaut = "80" if scheme == "http" else "443"
    if h.endswith(":" + defaut):
        h = h[: -(len(defaut) + 1)]
    return h


class Config:
    def __init__(self):
        self.url = (os.environ.get("HASS_URL") or "").rstrip("/")
        self.jeton = os.environ.get("HASS_TOKEN") or ""
        self.pont_jeton = os.environ.get("PONT_JETON") or ""
        self.auth = (os.environ.get("PONT_AUTH") or "jeton").strip().lower()
        self.prises = liste(os.environ.get("PONT_PRISES"))
        self.sondes = liste(os.environ.get("PONT_SONDES"))
        self.batteries = dict(
            p.split("=", 1) for p in liste(os.environ.get("PONT_BATTERIES")) if "=" in p
        )
        self.adresse = os.environ.get("PONT_ADRESSE") or "127.0.0.1"
        self.port = int(os.environ.get("PONT_PORT") or 8080)
        try:
            self.chauffe_max = int(os.environ.get("PONT_CHAUFFE_MAX") or 90)
        except ValueError:
            raise SystemExit(
                "pont : PONT_CHAUFFE_MAX doit être un nombre de minutes (0 = désactivé)."
            )
        if self.chauffe_max < 0:
            raise SystemExit(
                "pont : PONT_CHAUFFE_MAX doit être positif (0 = surveillance désactivée)."
            )
        # Délai au-delà duquel une sonde qui ne remonte plus fait couper la chauffe.
        # Décision d'installation : une résistance ne doit pas chauffer à l'aveugle.
        try:
            self.sans_mesure_max = int(os.environ.get("PONT_SANS_MESURE_MAX") or 15)
        except ValueError:
            raise SystemExit("pont : PONT_SANS_MESURE_MAX doit être un nombre de minutes.")
        if self.sans_mesure_max < 1:
            raise SystemExit(
                "pont : PONT_SANS_MESURE_MAX doit valoir au moins 1 minute "
                "(c'est le délai avant coupure quand la sonde se tait)."
            )
        # Fichier d'état : le plan de régulation et l'heure des dernières commandes. Vide,
        # il n'y a pas de persistance — c'est le cas des essais. En production il est monté
        # sur un volume, sans quoi un redémarrage de pod laisserait une chauffe allumée
        # que plus personne ne surveillerait.
        self.etat = os.environ.get("PONT_ETAT") or ""
        # Répertoire des magasins partagés (§2.C). Déduit de PONT_ETAT quand il n'est
        # pas donné : c'est le volume persistant déjà monté sur /data, et le manifeste
        # n'a donc rien de nouveau à déclarer. Vide, le partage n'est pas servi — mais
        # la régulation, elle, continue de fonctionner sur le plan repris de l'état.
        self.rep_donnees = os.environ.get("PONT_DONNEES") or (
            os.path.dirname(self.etat) if self.etat else ""
        )

    def verifier(self):
        """Refuse de démarrer dans une configuration dangereuse ou inutilisable."""
        manquants = [
            nom
            for nom, val in (("HASS_URL", self.url), ("HASS_TOKEN", self.jeton))
            if not val
        ]
        if manquants:
            raise SystemExit(
                "pont : variable(s) d'environnement manquante(s) : " + ", ".join(manquants)
            )
        # Deux modes, et un seul est le défaut. « aucune » doit être écrit noir sur
        # blanc dans le manifeste : une faute de frappe sur PONT_AUTH ne doit pas
        # ouvrir la commande des prises en silence.
        if self.auth not in ("jeton", "aucune"):
            raise SystemExit(
                "pont : PONT_AUTH=%r inconnu — valeurs acceptées : jeton, aucune." % self.auth
            )
        if self.auth == "aucune":
            print(
                "pont : PONT_AUTH=aucune — aucune authentification exigée "
                "(toute machine du réseau local peut commander les prises).",
                file=sys.stderr,
            )
        elif len(self.pont_jeton) < JETON_MIN:
            raise SystemExit(
                "pont : PONT_JETON est absent ou trop court (%d caractères, %d exigés). "
                "Le pont commande des prises physiques : refus de démarrer sans "
                "authentification (PONT_AUTH=aucune pour l'assumer sans jeton)."
                % (len(self.pont_jeton), JETON_MIN)
            )
        if not self.prises:
            raise SystemExit(
                "pont : PONT_PRISES est vide — aucune prise ne serait commandable ; "
                "configuration refusée."
            )
        if self.etat:
            # Une persistance annoncée mais inutilisable est pire que pas de persistance
            # du tout : on la croirait acquise, et un redémarrage laisserait une chauffe
            # sans échéance. On vérifie donc l'écriture tout de suite, au démarrage.
            try:
                with open(self.etat + ".essai", "w", encoding="utf-8") as f:
                    f.write("{}")
                os.remove(self.etat + ".essai")
            except OSError as e:
                raise SystemExit(
                    "pont : PONT_ETAT=%r inutilisable (%s : %s) — le plan de régulation ne "
                    "survivrait pas à un redémarrage. Corrigez le chemin, ou retirez "
                    "PONT_ETAT pour l'assumer explicitement."
                    % (self.etat, type(e).__name__, e.strerror or "")
                )
        if self.rep_donnees and not os.path.isdir(self.rep_donnees):
            # Annoncer un magasin partagé qui n'existe pas serait pire que ne pas en
            # avoir : les pages croiraient leurs données partagées et versionnées.
            raise SystemExit(
                "pont : PONT_DONNEES=%r n'est pas un répertoire — le document partagé "
                "ne pourrait pas être écrit." % self.rep_donnees
            )
        if self.adresse not in ("127.0.0.1", "localhost", "::1"):
            print(
                "pont : ATTENTION écoute sur %s — le pont ne devrait être joignable que "
                "par nginx (PONT_ADRESSE=127.0.0.1)" % self.adresse,
                file=sys.stderr,
            )


CFG = Config()
_verrou_etat = threading.Lock()
# Échéances des chauffes automatiques à couper (entité -> horodatage), et la période de
# surveillance : quinze secondes suffisent largement pour une consigne en minutes.
_verrou_echeances = threading.Lock()
_echeances = {}
PERIODE_SURVEILLANCE = 15
_cache = {"t": 0.0, "donnees": None}
# Plafonne les appels simultanés vers Home Assistant : si celui-ci pend, les threads
# du serveur s'accumulent jusqu'au plafond mémoire du conteneur, sinon.
_places_ha = threading.BoundedSemaphore(APPELS_SIMULTANES)


def appel_ha(chemin, methode="GET", corps=None):
    """Appelle l'API de Home Assistant. Renvoie l'objet JSON décodé."""
    donnees = json.dumps(corps).encode("utf-8") if corps is not None else None
    requete = urllib.request.Request(
        CFG.url + chemin,
        data=donnees,
        method=methode,
        headers={
            "Authorization": "Bearer " + CFG.jeton,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    if not _places_ha.acquire(timeout=DELAI_HA + 2):
        raise TimeoutError("Home Assistant saturé")
    try:
        with urllib.request.urlopen(requete, timeout=DELAI_HA) as reponse:
            brut = reponse.read()
    finally:
        _places_ha.release()
    return json.loads(brut.decode("utf-8")) if brut else None


def raison(e):
    """Décrit l'échec amont sans divulguer de secret, mais sans masquer l'essentiel."""
    if isinstance(e, urllib.error.HTTPError):
        # 401 = jeton Home Assistant invalide ou révoqué ; 404 = entité disparue.
        return "HTTP %d en amont" % e.code
    if isinstance(e, urllib.error.URLError):
        return "injoignable (%s)" % type(e.reason).__name__
    if isinstance(e, TimeoutError):
        return "Home Assistant saturé"
    return type(e).__name__


def nombre(valeur):
    try:
        v = float(valeur)
    except (TypeError, ValueError):
        return None
    # NaN et l'infini passent float() mais rendraient tout le JSON invalide côté
    # navigateur : une sonde douteuse ferait tomber l'affichage complet.
    return v if math.isfinite(v) else None


def etat_appareils():
    """Renvoie la liste blanche : prises (état on/off) et sondes (valeur, unité)."""
    with _verrou_etat:
        if _cache["donnees"] is not None and time.time() - _cache["t"] < CACHE_ETAT:
            return _cache["donnees"]
    etats = appel_ha("/api/states")
    if not isinstance(etats, list):
        raise ValueError("réponse inattendue de /api/states")
    par_entite = {
        e.get("entity_id"): e for e in etats if isinstance(e, dict) and e.get("entity_id")
    }

    def fiche(entite):
        e = par_entite.get(entite)
        if e is None:
            return {
                "entite": entite,
                "nom": entite,
                "domaine": entite.split(".", 1)[0],
                "etat": "inconnu",
                "valeur": None,
                "unite": None,
                "batterie": None,
                "disponible": False,
            }
        attrs = e.get("attributes")
        if not isinstance(attrs, dict):
            attrs = {}
        etat = str(e.get("state", "unknown"))
        disponible = etat not in ("unavailable", "unknown", "inconnu")
        f = {
            "entite": entite,
            "nom": str(attrs.get("friendly_name") or entite),
            "domaine": entite.split(".", 1)[0],
            "etat": etat,
            "valeur": nombre(etat),
            "unite": str(attrs["unit_of_measurement"]) if attrs.get("unit_of_measurement") else None,
            "batterie": None,
            "disponible": disponible,
            # Horodatage de Home Assistant, et son âge en secondes : sans eux, la page
            # ne peut pas distinguer une mesure qui vient d'arriver d'une valeur
            # vieille de six heures relue à l'instant. C'est ce qui rend visible une
            # sonde qui se tait, et ce qui permet au pont de couper à temps.
            "maj": e.get("last_updated"),
            "maj_age": age_mesure(e.get("last_updated")),
        }
        b = CFG.batteries.get(entite)
        if b:
            eb = par_entite.get(b)
            if isinstance(eb, dict):
                f["batterie"] = nombre(eb.get("state"))
        return f

    donnees = {
        "ok": True,
        "horodatage": int(time.time()),
        "appareils": [fiche(e) for e in CFG.prises] + [fiche(e) for e in CFG.sondes],
    }
    with _verrou_etat:
        _cache["t"] = time.time()
        _cache["donnees"] = donnees
    return donnees


def commander(entite, allume, auto=False):
    """Commande une prise de la liste blanche, puis relit son état réel.

    La multiprise (Meross MSS425f) peut renvoyer l'ancien état juste après la commande :
    on relit donc jusqu'à trois fois, et on n'invalide le cache qu'après coup (un
    /api/etat concurrent pourrait sinon le regarnir avec l'état d'avant).
    """
    service = "turn_on" if allume else "turn_off"
    # Le nom du service est choisi ici, jamais fourni par l'appelant ; l'entité a déjà
    # été validée contre la liste blanche : aucune injection possible.
    appel_ha("/api/services/switch/" + service, "POST", {"entity_id": entite})
    attendu = "on" if allume else "off"
    etat, confirme = None, False
    # La multiprise peut annoncer l'ancien état une à trois secondes après la commande :
    # on relit donc jusqu'à six fois, sans quoi l'interface affiche un état faux.
    for essai in range(6):
        e = appel_ha("/api/states/" + entite)
        etat = str((e or {}).get("state", "inconnu"))
        if etat == attendu:
            confirme = True
            break
        if essai < 5:
            time.sleep(0.7)
    with _verrou_etat:
        _cache["donnees"] = None
    # Sécurité : une chauffe commandée par la régulation automatique est coupée par le
    # pont lui-même si personne ne la décommande — page fermée, onglet tué, réseau
    # coupé. Une commande manuelle, elle, n'est jamais coupée : c'est l'utilisateur
    # qui décide, y compris de laisser chauffer deux heures.
    if CFG.chauffe_max > 0:
        with _verrou_echeances:
            if allume and auto:
                _echeances[entite] = time.time() + CFG.chauffe_max * 60
            else:
                _echeances.pop(entite, None)
    return {"ok": True, "entite": entite, "etat": etat, "confirme": confirme}


# ---------------------------------------------------------------------------
# Régulation tenue par le pont
#
# Pourquoi ici et pas dans la page : une fermentation dure des jours et personne
# ne garde un onglet ouvert trois semaines. Tant que la décision était prise par
# le navigateur, fermer la page arrêtait la régulation — la consigne n'était plus
# tenue du tout. Le pont, lui, ne s'arrête pas : c'est donc lui qui décide, et il
# est le seul à pouvoir le faire sans qu'une page soit ouverte.
#
# Le plan n'est plus déposé : il est DÉDUIT du document partagé (protocole v2 §4).
# Le navigateur reste le poste de réglage — il lit, édite et écrit le document — mais
# aucun appareil ne peut plus faire chauffer une prise sans écrire dans la vérité
# commune. Le pont, lui, ne commande jamais autre chose que les prises de sa liste
# blanche, même si le document en désigne d'autres : c'est la liste blanche qui garde
# la main, pas le document.
# ---------------------------------------------------------------------------
_verrou_plan = threading.Lock()
_plan = {"lots": [], "recu": 0.0, "sans_mesure_max": 0}
_decisions = []
# Provenance du plan déduit, et ce qui a été écarté : c'est ce que GET /api/regul
# donne à lire, pour qu'un lot qui ne chauffe pas puisse dire pourquoi.
_source_plan = {"rev": 0, "maj": 0, "lu": 0, "exclus": [], "degrade": False}
_derniere_commande = {}
# Ce que le pont a lui-même allumé, et pour quel lot. Sans cette mémoire, une prise
# allumée par la régulation dont le lot disparaît du plan (recette annulée ou archivée)
# devenait invisible : allumée, et plus personne ne la commandait. Constaté en service.
_allumees_par_pont = {}
PERIODE_REGULATION = 20
DECISIONS_MAX = 60
# Une mesure disponible mais plus rafraîchie n'est pas la même chose qu'une sonde que
# Home Assistant déclare indisponible. Une sonde simplement stable peut dépasser quinze
# minutes sans réécrire sa valeur (mesuré sur le parc réel : 50 s, 784 s et 935 s d'âge
# sur trois sondes vivantes) : on ne coupe donc pas les prises tout de suite, on coupe
# au bout d'une heure — quatre fois la cadence observée — et on cesse de repousser
# l'échéance, pour que le plafond de chauffe fasse son travail.
FRAICHEUR_TOLEREE = 3600


def age_mesure(horodatage):
    """Âge, en secondes, d'une mesure datée par Home Assistant.

    Renvoie None si l'horodatage est absent ou illisible : dans le doute on ne
    prétend pas que la mesure est fraîche, on dit qu'on ne sait pas.
    """
    if not isinstance(horodatage, str):
        return None
    try:
        t = datetime.datetime.fromisoformat(horodatage.replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None
    return max(0.0, time.time() - t)


def sauver_etat():
    """Écrit le plan et l'heure des dernières commandes sur disque.

    Le plan ne peut pas vivre seulement en mémoire : un redémarrage de pod laisserait
    une chauffe allumée que plus personne ne surveillerait. Ce qui est écrit ici suffit
    à reconstruire les échéances de sécurité au redémarrage (l'heure de la dernière
    commande + le plafond), sans jamais les remettre à zéro — sinon un redémarrage
    prolongerait indéfiniment une chauffe.
    """
    if not CFG.etat:
        return
    charge = {
        "lots": _plan["lots"],
        "recu": _plan["recu"],
        "sans_mesure_max": _plan["sans_mesure_max"],
        "dernieres": _derniere_commande,
        "allumees": _allumees_par_pont,
    }
    try:
        tmp = CFG.etat + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(charge, f, ensure_ascii=False)
        os.replace(tmp, CFG.etat)
    except OSError as e:
        print("pont : état non enregistré (%s)" % type(e).__name__, file=sys.stderr, flush=True)


def charger_etat():
    """Relit le plan au démarrage et coupe ce qui aurait dû l'être pendant l'arrêt."""
    if not CFG.etat or not os.path.exists(CFG.etat):
        return
    try:
        with open(CFG.etat, encoding="utf-8") as f:
            charge = json.load(f)
    except (OSError, ValueError) as e:
        print("pont : état illisible (%s) — ignoré" % type(e).__name__, file=sys.stderr, flush=True)
        return
    lots = charge.get("lots")
    if not isinstance(lots, list):
        return
    with _verrou_plan:
        _plan["lots"] = lots
        _plan["recu"] = float(charge.get("recu") or 0)
        _plan["sans_mesure_max"] = int(charge.get("sans_mesure_max") or 0)
        dernieres = charge.get("dernieres")
        if isinstance(dernieres, dict):
            for entite, t in dernieres.items():
                if isinstance(t, (int, float)):
                    _derniere_commande[entite] = float(t)
        allumees = charge.get("allumees")
        if isinstance(allumees, dict):
            for entite, memo in allumees.items():
                if isinstance(memo, dict):
                    _allumees_par_pont[entite] = memo
    # Les échéances se reconstruisent depuis l'heure de la dernière commande : un
    # redémarrage ne remet donc pas le compteur à zéro, il le laisse courir.
    if CFG.chauffe_max > 0:
        with _verrou_echeances:
            for entite, t in _derniere_commande.items():
                _echeances[entite] = t + CFG.chauffe_max * 60
    actifs = [l for l in lots if l.get("actif")]
    print(
        "pont : état repris — %d lot(s) dont %d actif(s), %d échéance(s) restaurée(s)"
        % (len(lots), len(actifs), len(_echeances)),
        flush=True,
    )


# ---------------------------------------------------------------------------
# Magasins persistants (protocole v2 §2.C)
#
# « donnees »   : le document partagé, versionné, arbitré par une révision globale.
#                 Le pont n'en comprend que la tranche de régulation du §4 ; tout le
#                 reste est stocké tel quel, jamais lu, jamais réécrit.
# « decisions » : ce que le pont a réellement commuté, une ligne JSON par décision.
#                 Elles ne vivent plus seulement en mémoire : le pont peut chauffer
#                 trois jours, redémarrer, et il doit rester la trace de ce qu'il a
#                 commandé sans qu'aucune page ne soit ouverte.
#
# Le fichier donnees.json contient EXACTEMENT le corps de la réponse de
# GET /api/donnees. Le pont le sert donc octet pour octet, sans l'analyser pour le
# rendre (§2.A), et sans ré-sérialiser un demi-mégaoctet à chaque lecture.
# ---------------------------------------------------------------------------
_verrou_doc = threading.Lock()        # protège le cache de lecture (une analyse à la fois)
_verrou_ecriture = threading.Lock()   # une écriture à la fois dans CE processus
_verrou_decisions = threading.Lock()  # un ajout à la fois dans decisions.jsonl
_doc_cache = {
    "empreinte": None, "rev": 0, "maj": 0, "semence": None,
    "octets": 0, "corps": None, "document": None,
}
# Depuis quand le document est illisible, et ce qu'on en a déjà dit (§4.5).
_doc_illisible = {"depuis": None, "echeance_dite": False}


def magasin_present():
    return bool(CFG.rep_donnees)


def _ch(nom):
    return os.path.join(CFG.rep_donnees, nom)


def _fsync_repertoire():
    """Rend le renommage lui-même durable.

    Sans ce fsync, le répertoire peut encore désigner l'ancien fichier après une
    coupure de courant : l'écriture serait atomique sans être durable.
    """
    try:
        fd = os.open(CFG.rep_donnees, os.O_RDONLY)
    except OSError:
        # Certains systèmes refusent d'ouvrir un répertoire (Windows) : le contenu du
        # fichier, lui, a bien été synchronisé.
        return
    try:
        os.fsync(fd)
    except OSError:
        pass
    finally:
        os.close(fd)


def _ecrire_durable(chemin, octets):
    """Écrit un fichier de façon atomique ET durable.

    Dans cet ordre, sans exception : temporaire, flush, fsync du descripteur,
    fermeture, os.replace, fsync du répertoire. Un os.replace durable dont les blocs
    de données ne le sont pas laisse un document tronqué après une coupure — et le
    document est la seule copie de la vérité.
    """
    tmp = chemin + ".tmp"
    with open(tmp, "wb") as f:
        f.write(octets)
        f.flush()
        os.fsync(f.fileno())
    # Le renommage peut échouer alors que rien n'est en panne : sur certains systèmes,
    # remplacer un fichier qu'un autre processus a ouvert en lecture est refusé — et
    # avec deux pods et une page qui sonde, un lecteur est souvent là. Rendre un 507
    # pour cette raison ferait croire à une panne de volume et ferait réessayer la page
    # sans motif. On réessaie donc brièvement avant d'abandonner. Une vraie panne
    # (volume plein, système de fichiers en lecture seule) a déjà échoué plus haut, à
    # l'écriture du temporaire.
    for essai in range(10):
        try:
            os.replace(tmp, chemin)
            break
        except OSError:
            if essai == 9:
                raise
            time.sleep(0.05)
    _fsync_repertoire()


@contextlib.contextmanager
def verrou_fichier():
    """Verrou d'écriture inter-processus sur /data/donnees.verrou.

    Deux pods montent le même /data pendant un déploiement, et les deux régulent.
    Avec une révision tenue en mémoire, chaque processus a son compteur : les deux
    acceptent « base == leur rev », le second os.replace écrase le premier, et aucun
    409 n'est émis. La perte de mise à jour passerait par le seul chemin que le 409 ne
    voit pas. Le verrou est tenu pour périmé au bout de VERROU_PERIME secondes : un
    pod tué pendant une écriture ne doit pas bloquer les écritures pour toujours.
    """
    chemin = _ch("donnees.verrou")
    limite = time.time() + VERROU_ATTENTE
    fd = None
    while fd is None:
        try:
            fd = os.open(chemin, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            try:
                age = time.time() - os.stat(chemin).st_mtime
            except OSError:
                age = 0.0
            if age > VERROU_PERIME:
                try:
                    os.unlink(chemin)
                except OSError:
                    pass
                continue
            if time.time() >= limite:
                raise TimeoutError("verrou d'écriture occupé")
            time.sleep(0.1)
    try:
        try:
            os.write(fd, str(os.getpid()).encode("ascii"))
        except OSError:
            pass
        yield
    finally:
        os.close(fd)
        try:
            os.unlink(chemin)
        except OSError:
            pass


def _enveloppe(rev, maj, semence, texte_donnees):
    """Construit les octets stockés : exactement le corps de GET /api/donnees."""
    entete = json.dumps(
        {"ok": True, "rev": rev, "maj": maj, "semence": semence}, ensure_ascii=False
    )
    return (entete[:-1] + ', "donnees": ' + texte_donnees + "}").encode("utf-8")


def lire_enveloppe():
    """Lit l'enveloppe stockée. None si le document n'a jamais été écrit.

    Lève OSError ou ValueError si le document est présent mais illisible — c'est le
    cas du §4.5, et il ne doit jamais être confondu avec « pas encore écrit ».

    Le fichier n'est relu et analysé que lorsqu'il a changé (mtime, taille, inode) :
    en régime stable, la route de sondage ne fait donc qu'un stat().
    """
    chemin = _ch("donnees.json")
    try:
        st = os.stat(chemin)
    except FileNotFoundError:
        return None
    empreinte = (st.st_mtime_ns, st.st_size, st.st_ino)
    with _verrou_doc:
        if _doc_cache["empreinte"] == empreinte:
            return dict(_doc_cache)
        with open(chemin, "rb") as f:
            corps = f.read()
        entete = json.loads(corps.decode("utf-8"))
        if not isinstance(entete, dict) or not isinstance(entete.get("rev"), int):
            raise ValueError("enveloppe sans révision")
        if not isinstance(entete.get("donnees"), dict):
            raise ValueError("enveloppe sans objet « donnees »")
        _doc_cache.update(
            {
                "empreinte": empreinte,
                "rev": entete["rev"],
                "maj": int(entete.get("maj") or 0),
                "semence": entete.get("semence"),
                "octets": st.st_size,
                "corps": corps,
                "document": entete["donnees"],
            }
        )
        return dict(_doc_cache)


def lire_precedent():
    """Lit la génération précédente du document (§4.5). None si elle manque."""
    try:
        with open(_ch("donnees.precedent.json"), "rb") as f:
            corps = f.read()
        entete = json.loads(corps.decode("utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(entete, dict) or not isinstance(entete.get("rev"), int):
        return None
    return {
        "rev": entete["rev"],
        "maj": int(entete.get("maj") or 0),
        "semence": entete.get("semence"),
        "octets": len(corps),
        "corps": corps,
    }


def lire_sceau():
    """Sceau d'installation (G4). Renvoie (présent, semence, rev_max).

    Un sceau présent mais illisible est tenu pour PRÉSENT : il ne doit pas suffire
    d'abîmer semence.json pour rouvrir la porte du « base: 0 » qui efface tout.
    """
    chemin = _ch("semence.json")
    if not os.path.exists(chemin):
        return False, None, 0
    try:
        with open(chemin, encoding="utf-8") as f:
            s = json.load(f)
    except (OSError, ValueError):
        return True, None, 0
    if not isinstance(s, dict):
        return True, None, 0
    semence = s.get("semence")
    rev_max = s.get("rev_max")
    return (
        True,
        semence if isinstance(semence, str) and semence else None,
        rev_max if isinstance(rev_max, int) and not isinstance(rev_max, bool) else 0,
    )


def ecrire_sceau(semence, rev):
    _ecrire_durable(
        _ch("semence.json"),
        json.dumps(
            {"semence": semence, "rev_max": rev, "maj": int(time.time())},
            ensure_ascii=False,
        ).encode("utf-8"),
    )


def lire_meta():
    """Lit ce qui accompagne le document : « op » appliqués, quarantaines, derniers « maj ».

    La quarantaine est la liste des lots dont une réactivation a été refusée par la
    garde du §4.4 : ils sont écrits, mais exclus du plan jusqu'à ce qu'un POST les
    nomme dans « reactiver ».

    Les derniers « maj » connus vivent ICI, par identifiant de lot, et NON dans le
    document. Les lire dans le document laissait la garde aveugle au cas le plus
    courant — un lot SUPPRIMÉ : son « maj » disparaissait avec lui, un appareil périmé
    rejouait le lot actif, et la prise se rallumait sans un seul avertissement. C'est
    l'incident d'origine (une suppression qui ne se propage pas) reconstruit sur une
    résistance. Reproduit par `_verify/verif-d1-lot-supprime.py`.
    """
    try:
        with open(_ch("donnees-meta.json"), encoding="utf-8") as f:
            m = json.load(f)
    except FileNotFoundError:
        m = {}
    except (OSError, ValueError) as e:
        print(
            "pont : donnees-meta.json illisible (%s) — idempotence, quarantaines et "
            "derniers « maj » repartent de zéro" % type(e).__name__,
            file=sys.stderr,
            flush=True,
        )
        m = {}
    if not isinstance(m, dict):
        m = {}
    ops = [
        o
        for o in (m.get("ops") or [])
        if isinstance(o, dict) and isinstance(o.get("op"), str)
    ]
    quarantaine = [x for x in (m.get("quarantaine") or []) if isinstance(x, str)]
    majs = {}
    for ident, v in (m.get("majs") or {}).items():
        if isinstance(ident, str) and isinstance(v, int) and not isinstance(v, bool):
            majs[ident] = v
    return {
        "ops": ops[-OPS_RETENUS:],
        "quarantaine": quarantaine,
        "majs": majs,
    }


def ecrire_meta(ops, quarantaine, majs=None):
    # L'ordre d'arrivée est conservé : c'est lui qui dit quelle quarantaine tombe la
    # première si leur nombre devait être plafonné.
    propre = list(dict.fromkeys(quarantaine))[-QUARANTAINE_MAX:]
    # Les « maj » sont plafonnés comme la quarantaine : un lot supprimé garde son
    # souvenir, mais la mémoire ne croît pas indéfiniment. Les plus RÉCENTS sont
    # conservés — ce sont eux qui protègent contre une résurrection.
    propres_majs = {}
    if majs:
        gardes = sorted(
            ((i, v) for i, v in majs.items() if isinstance(v, int)),
            key=lambda kv: kv[1],
            reverse=True,
        )[:MAJS_MAX]
        propres_majs = {i: v for i, v in gardes}
    _ecrire_durable(
        _ch("donnees-meta.json"),
        json.dumps(
            {
                "ops": list(ops)[-OPS_RETENUS:],
                "quarantaine": propre,
                "majs": propres_majs,
            },
            ensure_ascii=False,
        ).encode("utf-8"),
    )


def noter_fichier(entree):
    """Ajoute une décision au magasin append-only, et le tourne à 256 Kio.

    Une seule génération est conservée : le volume fait 8 Mi, et ce qui compte est de
    pouvoir dire ce que le pont a commuté, pas de tout garder.
    """
    if not magasin_present():
        return
    try:
        ligne = json.dumps(entree, ensure_ascii=False, allow_nan=False) + "\n"
    except ValueError:
        return
    chemin = _ch("decisions.jsonl")
    with _verrou_decisions:
        try:
            try:
                if os.stat(chemin).st_size >= DECISIONS_FICHIER_MAX:
                    os.replace(chemin, chemin + ".1")
            except FileNotFoundError:
                pass
            with open(chemin, "a", encoding="utf-8") as f:
                f.write(ligne)
                f.flush()
                os.fsync(f.fileno())
        except OSError as e:
            print(
                "pont : décision non journalisée (%s)" % type(e).__name__,
                file=sys.stderr,
                flush=True,
            )


def decisions_depuis(depuis):
    """Décisions postérieures à « depuis » (secondes), génération précédente comprise."""
    sorties = []
    for chemin in (_ch("decisions.jsonl.1"), _ch("decisions.jsonl")):
        try:
            with open(chemin, encoding="utf-8") as f:
                for ligne in f:
                    ligne = ligne.strip()
                    if not ligne:
                        continue
                    try:
                        e = json.loads(ligne)
                    except ValueError:
                        # Une ligne tronquée par une coupure ne doit pas faire perdre
                        # les autres : c'est l'intérêt d'un fichier ligne à ligne.
                        continue
                    if isinstance(e, dict) and (e.get("t") or 0) > depuis:
                        sorties.append(e)
        except OSError:
            continue
    return sorties[-DECISIONS_SERVIES_MAX:]


def noter_protocole(lot, message):
    """Journalise un événement de protocole : écriture, résurrection, dégradation.

    Même magasin que les commutations : c'est là que l'exploitant doit pouvoir lire
    pourquoi un lot ne chauffe pas.
    """
    entree = {
        "t": int(time.time()),
        "lot": lot,
        "nom": None,
        "entite": None,
        "allume": None,
        "x": message,
    }
    noter_fichier(entree)
    with _verrou_plan:
        _decisions.append(entree)
        del _decisions[:-DECISIONS_MAX]
    print("pont : %s" % message, flush=True)


# ---------------------------------------------------------------------------
# Déduction du plan (protocole v2 §4)
# ---------------------------------------------------------------------------
def _appareils_du_lot(appareils, ident):
    """Appareils rattachés au lot, hors appareils sans entité et de démonstration.

    Reproduit « devsOf(b).filter(d => d.eid && !d.demo) » : un appareil de maquette
    porte les VRAIES entités de la multiprise, et un navigateur neuf ne doit pas
    commander les prises du laboratoire au premier coup d'œil.
    """
    return [
        d
        for d in appareils
        if isinstance(d, dict)
        and d.get("batch") == ident
        and isinstance(d.get("eid"), str)
        and d.get("eid")
        and not d.get("demo")
    ]


def _ecarter(exclus, ident, nom, motif):
    """Écarte un lot du plan, avec son motif : un lot qui ne chauffe pas doit pouvoir
    dire pourquoi, sinon la raison reste enterrée dans les décisions."""
    exclus.append({"lot": ident, "nom": nom, "motif": motif})


def deduire_plan(document, quarantaine=()):
    """Déduit le plan de régulation du document partagé, champ par champ (§4.1-4.4).

    Renvoie (lots du plan, exclus). Un lot est écrit même quand il casserait la
    régulation : il est alors exclu du plan avec un motif, et l'exclusion ARRÊTE la
    chauffe par le balayage des prises non réclamées — elle ne la lance pas. C'est
    pourquoi le sens sûr est d'exclure, et non de refuser l'écriture.

    La consigne vient de « lot.recipe », la copie figée que le lot porte lui-même, et
    jamais de « donnees.recettes » : éditer une recette ne doit pas changer la
    consigne d'une fermentation en cours, et en supprimer une ne doit pas faire
    disparaître la chauffe d'un lot que l'utilisateur croit actif.
    """
    lots_bruts = document.get("lots")
    if not isinstance(lots_bruts, list):
        return [], [{"lot": None, "nom": None, "motif": "document sans liste « lots »"}]
    appareils = document.get("appareils")
    if not isinstance(appareils, list):
        appareils = []
    plan, exclus = [], []
    for index, brut in enumerate(lots_bruts):
        if not isinstance(brut, dict):
            continue
        ident = brut.get("id")
        if not isinstance(ident, str) or not ident:
            continue
        # « actif » est exactement « status === "active" ». Un lot qui ne l'est pas
        # n'entre pas dans le plan : il n'est pas non plus « exclu », il n'est rien
        # demandé pour lui — et ses prises sont coupées par le balayage.
        if brut.get("status") != "active":
            continue
        nom = str(brut.get("nom") or brut.get("name") or ident)[:80]
        if ident in quarantaine:
            _ecarter(
                exclus, ident, nom,
                "réactivation refusée : « maj » antérieur à celui enregistré par le "
                "pont — POST avec reactiver:[\"%s\"] pour l'autoriser" % ident,
            )
            continue
        recette = brut.get("recipe")
        if not isinstance(recette, dict):
            _ecarter(exclus, ident, nom, "copie figée de la recette absente du lot")
            continue
        consigne = nombre(recette.get("temp"))
        if consigne is None:
            _ecarter(
                exclus, ident, nom,
                "consigne absente ou illisible dans la copie figée de la recette",
            )
            continue
        tolerance = nombre(recette.get("tol"))
        # Les tolérances par type de produit ne servent qu'à l'affichage : les prendre
        # ici élargirait un miso à ±4 °C sans que personne l'ait demandé.
        ecart = abs(tolerance) if tolerance is not None else 0.2
        debut = nombre(brut.get("start")) or time.time() * 1000.0
        duree = nombre(recette.get("duration"))
        # La fin de lot part en SECONDES, comme time.time(), et « duration » est en
        # jours. math.floor(x + 0.5) reproduit Math.round de la page.
        fin = (
            math.floor(debut / 1000.0 + duree * 86400.0 + 0.5)
            if duree is not None and duree > 0
            else None
        )
        appareils_lot = _appareils_du_lot(appareils, ident)
        prises = [d["eid"] for d in appareils_lot if d.get("kind") == "plug"]
        # Sonde de TEMPÉRATURE exclusivement : une sonde d'humidité est rattachée à un
        # lot et figure dans la liste blanche des sondes. Chauffer sur elle, c'est
        # chauffer à l'aveugle.
        sondes = [d["eid"] for d in appareils_lot if d.get("kind") == "temp"]
        if not prises:
            _ecarter(
                exclus, ident, nom, "aucune prise rattachée (hors appareils de démonstration)"
            )
            continue
        if not sondes:
            _ecarter(exclus, ident, nom, "aucune sonde de température rattachée")
            continue
        if len(set(sondes)) > 1:
            # Deux sondes qui lisent 3 °C d'écart décideraient, par l'ordre du tableau,
            # si une résistance chauffe. On n'arbitre pas : on exclut, et on le dit.
            _ecarter(
                exclus, ident, nom,
                "deux sondes de température rattachées (%s)"
                % ", ".join(sorted(set(sondes))),
            )
            continue
        lot, motif = valider_lot(
            {
                "id": ident,
                "nom": nom,
                "consigne": consigne,
                "sonde": sondes[0],
                "prises": prises,
                "ecart": ecart,
                "fin": fin,
                "actif": True,
            },
            index,
        )
        if lot is None:
            # Liste blanche, consigne hors bornes, fin aberrante : le document les
            # accepte, le plan non. Motif inchangé, celui de valider_lot.
            _ecarter(exclus, ident, nom, motif)
            continue
        plan.append(lot)
    return plan, exclus


def echeance_gelee():
    """Vrai quand le document est illisible depuis plus de DOCUMENT_ILLISIBLE_MAX.

    Le pont cesse alors de repousser l'échéance de sécurité, de sorte que le plafond
    de chauffe coupe de lui-même. Sans cette borne, un lot archivé à l'instant même où
    le fichier devient illisible chaufferait indéfiniment, sans qu'aucune page puisse
    écrire pour le contredire.
    """
    depuis = _doc_illisible["depuis"]
    return depuis is not None and time.time() - depuis > DOCUMENT_ILLISIBLE_MAX


def _plan_degrade(erreur):
    """Document illisible : on garde le plan précédent, mais pas sans échéance (§4.5)."""
    maintenant = time.time()
    if _doc_illisible["depuis"] is None:
        _doc_illisible["depuis"] = maintenant
        noter_protocole(
            None,
            "document partagé illisible (%s) — plan précédent conservé, aucune "
            "chauffe coupée pour cette raison" % type(erreur).__name__,
        )
    if not _doc_illisible["echeance_dite"] and echeance_gelee():
        _doc_illisible["echeance_dite"] = True
        noter_protocole(
            None,
            "document illisible depuis %d min — plus d'échéance repoussée, coupure au "
            "plafond de chauffe" % int((maintenant - _doc_illisible["depuis"]) // 60),
        )
    with _verrou_plan:
        _source_plan["degrade"] = True
        _source_plan["lu"] = int(maintenant)


def rafraichir_plan():
    """Relit le document partagé — au plus une fois par tour — et en tire le plan."""
    if not magasin_present():
        return
    try:
        enveloppe = lire_enveloppe()
    except (OSError, ValueError) as e:
        return _plan_degrade(e)
    if enveloppe is None:
        rev, maj, document = 0, 0, {}
    else:
        rev, maj, document = enveloppe["rev"], enveloppe["maj"], enveloppe["document"]
    if _doc_illisible["depuis"] is not None:
        _doc_illisible.update({"depuis": None, "echeance_dite": False})
        noter_protocole(
            None, "document partagé redevenu lisible — plan déduit de la révision %d" % rev
        )
    quarantaine = set(lire_meta()["quarantaine"])
    plan, exclus = deduire_plan(document, quarantaine)
    with _verrou_plan:
        change = _plan["lots"] != plan
        _plan["lots"] = plan
        _plan["recu"] = time.time()
        # La page ne dépose plus de plan : le délai de coupure sur sonde muette vient
        # désormais de la seule décision d'installation, PONT_SANS_MESURE_MAX.
        _plan["sans_mesure_max"] = CFG.sans_mesure_max * 60
        _source_plan.update(
            {
                "rev": rev,
                "maj": maj,
                "lu": int(time.time()),
                "exclus": exclus,
                "degrade": False,
            }
        )
    if change:
        sauver_etat()
        print(
            "pont : plan déduit de la révision %d — %d lot(s) actif(s), %d écarté(s)"
            % (rev, len(plan), len(exclus)),
            flush=True,
        )


# ---------------------------------------------------------------------------
# Écriture du document partagé (protocole v2 §3)
# ---------------------------------------------------------------------------
def _sans_maj(lot):
    return {k: v for k, v in lot.items() if k != "maj"}


def _apposer_maj(document, anciens, quarantaine, autorises, maintenant, majs_connus=None):
    """Appose le « maj » de chaque lot et applique la garde du §4.4.

    « maj » est apposé par le pont, jamais accepté du client : un téléphone remis à la
    main ferait sinon gagner son lot de la semaine dernière, définitivement, sur un
    système qui commande des résistances. Il n'avance que quand le lot change
    vraiment — sinon chaque enregistrement de la page rajeunirait tous les lots et la
    garde ne verrait plus rien passer.

    `majs_connus` est la mémoire PERSISTANTE des derniers « maj », par lot. Elle fait
    autorité sur ce que porte le document, car un lot SUPPRIMÉ n'est plus dans le
    document : sans cette mémoire la garde ne voyait rien, un appareil périmé rejouait
    le lot actif et la prise se rallumait en silence.

    Fonction sans effet de bord : elle décide, elle ne journalise ni n'écrit rien.
    Les traces ne partent qu'une fois le document réellement écrit — journaliser une
    réactivation qui n'a pas eu lieu envoie chercher la panne au mauvais endroit.

    Renvoie (avertissements, quarantaines à poser, quarantaines à lever, traces).
    """
    avertissements, ajouts, retraits, traces = [], [], [], []
    lots = document.get("lots")
    if not isinstance(lots, list):
        return avertissements, ajouts, retraits, traces
    for brut in lots:
        if not isinstance(brut, dict):
            continue
        ident = brut.get("id")
        if not isinstance(ident, str) or not ident:
            continue
        ancien = anciens.get(ident)
        maj_connu = ancien.get("maj") if isinstance(ancien, dict) else None
        if not isinstance(maj_connu, int) or isinstance(maj_connu, bool):
            maj_connu = None
        # La mémoire persistante prime : elle survit à la suppression du lot, et c'est
        # le plus grand des deux souvenirs qui protège (jamais le plus permissif).
        memoire = (majs_connus or {}).get(ident)
        connu_de_memoire = isinstance(memoire, int) and not isinstance(memoire, bool)
        if connu_de_memoire:
            maj_connu = memoire if maj_connu is None else max(maj_connu, memoire)
        # Le lot a été SUPPRIMÉ du document courant, et le pont se souvient de lui : sa
        # réapparition à l'état actif est toujours suspecte, même avec un « maj » égal
        # au dernier connu. C'est le cas d'un appareil périmé qui rejoue sa copie telle
        # qu'il l'avait lue avant la suppression — « maj » identique, donc ni antérieur
        # ni postérieur. Exiger « strictement antérieur » laissait passer exactement
        # l'incident d'origine : une suppression non propagée qui rallume une prise.
        ressuscite_apres_suppression = ancien is None and connu_de_memoire
        presente = brut.get("maj")
        if not isinstance(presente, int) or isinstance(presente, bool):
            presente = None
        actif = brut.get("status") == "active"
        actif_avant = isinstance(ancien, dict) and ancien.get("status") == "active"
        inchange = ancien is not None and _sans_maj(brut) == _sans_maj(ancien)
        # Résurrection : un lot actif présenté avec un « maj » plus vieux que celui que
        # le pont a enregistré pour ce même identifiant. Le 409 ne la voit pas — il
        # compare des révisions, pas des contenus.
        #
        # « maj » absent : ce n'est pas un « maj » antérieur, et on ne traite pas comme
        # une résurrection l'édition ordinaire d'un lot déjà actif — ce serait mettre en
        # quarantaine tout lot touché par une page qui ne renvoie pas le champ. On ne
        # l'accepte en revanche PAS pour faire repasser un lot archivé à « actif » : ce
        # geste-là doit présenter le sceau du pont, ou passer par « reactiver ».
        # « presente < maj_connu » reste STRICT : un utilisateur qui édite un lot actif
        # dans la même seconde que le dernier « maj » enregistré présenterait sinon un
        # « maj » égal et verrait son lot mis en quarantaine — sa fermentation
        # s'arrêterait sur une édition légitime. La réapparition après suppression, elle,
        # est traitée à part : là, l'égalité est précisément la signature du rejeu.
        resurrection = (
            actif
            and not inchange
            and maj_connu is not None
            and (
                ressuscite_apres_suppression
                or (presente < maj_connu if presente is not None else not actif_avant)
            )
        )
        vu = "absent" if presente is None else presente
        if resurrection and ident in autorises:
            retraits.append(ident)
            avertissements.append(
                "%s : réactivation explicite demandée (reactiver) — lot remis au plan" % ident
            )
            traces.append(
                (
                    ident,
                    "réactivation explicite par reactiver[] : « maj » présenté %s, "
                    "« maj » enregistré %d" % (vu, maj_connu),
                )
            )
        elif resurrection:
            ajouts.append(ident)
            avertissements.append(
                "%s : lot actif présenté avec un « maj » antérieur — écrit, mais exclu "
                "du plan" % ident
            )
            traces.append(
                (
                    ident,
                    "réactivation refusée : « maj » présenté %s, « maj » enregistré %d "
                    "— lot écrit, exclu du plan" % (vu, maj_connu),
                )
            )
        elif ident in quarantaine and ident in autorises:
            retraits.append(ident)
            avertissements.append("%s : quarantaine levée (reactiver)" % ident)
            traces.append((ident, "quarantaine levée par reactiver[]"))
        elif ident in quarantaine and actif:
            avertissements.append(
                "%s : toujours exclu du plan — réactivation à confirmer par reactiver" % ident
            )
        brut["maj"] = maj_connu if inchange and maj_connu is not None else maintenant
    return avertissements, ajouts, retraits, traces


def ecrire_donnees(base, op, document, autorises):
    """Écrit le document partagé. Renvoie (code HTTP, charge de réponse)."""
    with _verrou_ecriture:
        try:
            with verrou_fichier():
                return _ecrire_verrouille(base, op, document, autorises)
        except TimeoutError:
            # Un autre pont écrit (déploiement en cours). Le client garde son état et
            # réessaie : c'est exactement ce que le 507 lui demande de faire.
            return 507, {"ok": False, "motif": "verrou", "op": op}
        except OSError as e:
            print(
                "pont : écriture du document impossible (%s : %s)"
                % (type(e).__name__, e.strerror or ""),
                file=sys.stderr,
                flush=True,
            )
            return 507, {"ok": False, "motif": "ecriture", "op": op}


def _ecrire_verrouille(base, op, document, autorises):
    """Corps de l'écriture, verrou de fichier tenu. La révision est relue du disque."""
    maintenant = int(time.time())
    sceau, semence, rev_max = lire_sceau()
    try:
        enveloppe = lire_enveloppe()
        illisible = False
    except (OSError, ValueError):
        enveloppe, illisible = None, True
    # Deux refus distincts, et l'ordre compte. Document PRÉSENT mais illisible : §4.5,
    # on sert la génération précédente en lecture et toute écriture est refusée en 507
    # jusqu'à décision de l'exploitant — écrire par-dessus ferait disparaître la cause.
    if illisible:
        return 507, {"ok": False, "motif": "illisible", "op": op}
    # Document ABSENT alors que le sceau existe : G4. Jamais une écriture — c'est par
    # ce chemin qu'un navigateur réensemencé effacerait des mois de relevés. Déblocage
    # par un geste d'exploitant (supprimer semence.json), jamais par une page.
    if sceau and enveloppe is None:
        return 409, {"ok": False, "motif": "semence", "rev": rev_max, "op": op}
    rev = enveloppe["rev"] if enveloppe else 0
    meta = lire_meta()
    if op:
        for vu in meta["ops"]:
            if vu.get("op") == op:
                # Rejeu d'une écriture déjà appliquée : 200 avec la révision qu'elle a
                # produite, et non 409 — sinon on propose à l'utilisateur d'adopter ce
                # qu'il vient lui-même d'écrire.
                return 200, {
                    "ok": True,
                    "rev": int(vu.get("rev") or rev),
                    "op": op,
                    "rejoue": True,
                    "avertissements": list(vu.get("avertissements") or []),
                }
    if base != rev:
        return 409, {
            "ok": False,
            "motif": "revision",
            "rev": rev,
            "op": op,
            "donnees": enveloppe["document"] if enveloppe else None,
        }
    anciens = {}
    if enveloppe:
        for l in enveloppe["document"].get("lots") or []:
            if isinstance(l, dict) and isinstance(l.get("id"), str):
                anciens[l["id"]] = l
    quarantaine = list(meta["quarantaine"])
    majs_connus = dict(meta["majs"])
    avertissements, ajouts, retraits, traces = _apposer_maj(
        document, anciens, set(quarantaine), autorises, maintenant, majs_connus
    )
    # Le « maj » vient d'être apposé : le texte reçu n'est plus celui qu'on stocke.
    # La taille est donc revérifiée ici, AVANT le moindre effet de bord.
    texte = json.dumps(document, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    if len(texte.encode("utf-8")) > DOCUMENT_MAX:
        return 413, {"ok": False, "motif": "taille", "octets_max": DOCUMENT_MAX, "op": op}
    # Mémoire des « maj » après apposition : elle ne RECULE jamais, et garde le souvenir
    # des lots absents du nouveau document — c'est tout l'intérêt (un lot supprimé doit
    # rester protégé contre une résurrection par un appareil périmé).
    for l in document.get("lots") or []:
        if isinstance(l, dict) and isinstance(l.get("id"), str):
            v = l.get("maj")
            if isinstance(v, int) and not isinstance(v, bool):
                precedent = majs_connus.get(l["id"])
                majs_connus[l["id"]] = (
                    v if not isinstance(precedent, int) else max(precedent, v)
                )
    if ajouts:
        # La mise en quarantaine est écrite AVANT le document : si l'écriture échoue
        # ensuite, on aura trop exclu — jamais trop peu. Exclure arrête une chauffe.
        ecrire_meta(meta["ops"], quarantaine + ajouts, majs_connus)
    if semence is None and enveloppe is not None:
        # Sceau illisible, mais le document porte lui-même la semence : on la reprend.
        # En forger une nouvelle ferait croire à toutes les pages que le pont a perdu
        # les données partagées (G1), et les figerait sans raison.
        portee = enveloppe["semence"]
        semence = portee if isinstance(portee, str) and portee else None
    if semence is None:
        semence = secrets.token_hex(8)
    nouvelle = rev + 1
    corps = _enveloppe(nouvelle, maintenant, semence, texte)
    if enveloppe is not None and enveloppe["corps"]:
        # Une génération précédente, et une seule : c'est elle qu'on sert en lecture
        # quand le document devient illisible (§4.5).
        _ecrire_durable(_ch("donnees.precedent.json"), enveloppe["corps"])
    # L'ordre est contractuel : la révision ne change qu'après que l'écriture a réussi.
    # Elle est dans l'enveloppe elle-même, donc indissociable du contenu : un
    # os.replace raté laisse la révision précédente intacte, et le 507 part plus haut.
    _ecrire_durable(_ch("donnees.json"), corps)
    for ident, message in traces:
        noter_protocole(ident, message)
    quarantaine_finale = [
        x for x in dict.fromkeys(quarantaine + ajouts) if x not in retraits
    ]
    plan, exclus = deduire_plan(document, set(quarantaine_finale))
    for x in exclus:
        avertissements.append(
            "%s : %s" % (x["lot"], x["motif"]) if x.get("lot") else x["motif"]
        )
    ops = [o for o in meta["ops"] if o.get("op") != op]
    if op:
        ops.append({"op": op, "rev": nouvelle, "avertissements": avertissements[:20]})
    try:
        ecrire_meta(ops, quarantaine_finale, majs_connus)
        ecrire_sceau(semence, max(nouvelle, rev_max))
    except OSError as e:
        # Le document, lui, est écrit : répondre 507 ferait rejouer une écriture déjà
        # faite. On le dit dans la réponse plutôt que de le taire.
        avertissements.append(
            "accessoires non enregistrés (%s) : un rejeu de cette écriture recevra un "
            "409 au lieu d'un 200" % type(e).__name__
        )
        print(
            "pont : accessoires du document non enregistrés (%s)" % type(e).__name__,
            file=sys.stderr,
            flush=True,
        )
    noter_protocole(
        None,
        "document partagé écrit — révision %d, %d octet(s), %d lot(s) au plan, "
        "%d écarté(s)" % (nouvelle, len(corps), len(plan), len(exclus)),
    )
    return 200, {"ok": True, "rev": nouvelle, "op": op, "avertissements": avertissements}


def valider_lot(brut, index):
    """Valide un lot de plan. Renvoie (lot propre, motif de refus)."""
    if not isinstance(brut, dict):
        return None, "lot %d : objet attendu" % index
    ident = brut.get("id")
    if not isinstance(ident, str) or not ident or len(ident) > 64:
        return None, "lot %d : identifiant invalide" % index
    consigne = nombre(brut.get("consigne"))
    if consigne is None or not (-10 <= consigne <= 120):
        return None, "lot %s : consigne invalide (attendu entre -10 et 120 °C)" % ident
    sonde = brut.get("sonde")
    if sonde not in CFG.sondes:
        return None, "lot %s : sonde %r hors liste blanche" % (ident, sonde)
    prises = brut.get("prises")
    if not isinstance(prises, list) or not prises or len(prises) > 16:
        return None, "lot %s : liste de prises invalide" % ident
    for p in prises:
        if p not in CFG.prises:
            return None, "lot %s : prise %r hors liste blanche" % (ident, p)
    ecart = nombre(brut.get("ecart"))
    if ecart is None:
        ecart = 0.2
    if not (0 <= ecart <= 5):
        return None, "lot %s : écart invalide" % ident
    fin = nombre(brut.get("fin"))
    # La fin de lot est un INSTANT EN SECONDES, comme time.time(). On refuse les valeurs
    # aberrantes, et notamment un horodatage en millisecondes : comparé à time.time(), il
    # serait dans un futur lointain, et la coupure de fin de lot ne se déclencherait
    # jamais. (C'est exactement le défaut trouvé en relecture : la page envoyait des
    # millisecondes, et la chauffe ne s'arrêtait donc jamais à l'échéance prévue.)
    if fin is not None and (fin <= 0 or fin > time.time() + 400 * 86400):
        return None, "lot %s : fin de lot invalide (instant en secondes attendu)" % ident
    return (
        {
            "id": ident,
            "nom": str(brut.get("nom") or ident)[:80],
            "consigne": consigne,
            "sonde": sonde,
            # Dédoublonnage : une prise citée deux fois ne serait commandée qu'une fois.
            "prises": list(dict.fromkeys(prises)),
            "ecart": ecart,
            "fin": fin,
            # Un lot sans « actif » explicite n'est pas un lot actif : le doute doit
            # arrêter la chauffe, jamais la lancer.
            "actif": brut.get("actif") is True,
        },
        None,
    )


def lire_sonde(entite):
    """Lit une sonde, l'âge réel de sa mesure et son unité.

    La fraîcheur ne peut pas venir du moment où le pont a lu : une valeur lue à
    l'instant peut avoir six heures si la sonde s'est tue entre-temps. Seul
    Home Assistant sait quand la mesure est arrivée — on lui demande.
    """
    e = appel_ha("/api/states/" + entite)
    etat = str((e or {}).get("state", "inconnu"))
    attrs = (e or {}).get("attributes")
    unite = attrs.get("unit_of_measurement") if isinstance(attrs, dict) else None
    if etat in ("unavailable", "unknown", "inconnu", ""):
        # On garde l'âge même sans valeur : c'est lui qui dit depuis quand Home
        # Assistant n'a plus de nouvelles, et donc quand la coupure est due.
        return {
            "valeur": None,
            "age": age_mesure((e or {}).get("last_updated")),
            "etat": etat,
            "unite": unite,
        }
    return {
        "valeur": nombre(etat),
        "age": age_mesure((e or {}).get("last_updated")),
        "etat": etat,
        "unite": str(unite) if unite else None,
    }


def etat_prise(entite):
    """État réel d'une prise, relu chez Home Assistant (jamais supposé)."""
    e = appel_ha("/api/states/" + entite)
    return str((e or {}).get("state", "inconnu"))


def noter(lot, message, entite=None, allume=None):
    """Retient une décision, et l'écrit dans le magasin append-only.

    La mémoire seule ne suffit pas : plafonnée à soixante entrées, perdue au
    redémarrage, et lue par une page ouverte uniquement. Le pont peut chauffer trois
    jours sans qu'aucune page ne soit ouverte — c'est la promesse du §2.B — donc la
    trace de ce qu'il a commuté doit survivre à son propre redémarrage.
    """
    entree = {
        "t": int(time.time()),
        "lot": lot.get("id"),
        "nom": lot.get("nom"),
        "entite": entite,
        "allume": allume,
        "x": message,
    }
    with _verrou_plan:
        _decisions.append(entree)
        del _decisions[:-DECISIONS_MAX]
    noter_fichier(entree)
    print("pont : régulation — %s : %s" % (lot.get("nom"), message), flush=True)


def commander_regule(lot, entite, allume, motif):
    """Commande une prise du plan, au plus une fois par minute et par prise."""
    maintenant = time.time()
    with _verrou_plan:
        if maintenant - _derniere_commande.get(entite, 0.0) < 60:
            return False
        _derniere_commande[entite] = maintenant
    r = commander(entite, allume, auto=True)
    ok = r.get("etat") == ("on" if allume else "off")
    if ok:
        # On retient ce qu'on a allumé soi-même : c'est ce qui permet de le couper si
        # le lot quitte le plan, plutôt que de le laisser chauffer sans témoin.
        with _verrou_plan:
            if allume:
                _allumees_par_pont[entite] = {
                    "lot": lot.get("id"),
                    "nom": lot.get("nom"),
                    "t": maintenant,
                }
            else:
                _allumees_par_pont.pop(entite, None)
    noter(lot, "%s : %s — %s" % (entite, "chauffe" if allume else "arrêt", motif), entite, allume)
    sauver_etat()
    return ok


def couper_orphelines(voulues):
    """Coupe toute prise commandable allumée qu'aucune recette en cours ne réclame.

    Règle du propriétaire : une prise non liée à un projet n'est pas activée. Elle vaut
    pour ce que le pont a lui-même allumé (lot disparu du plan : recette annulée,
    archivée ou mise en pause — le tour de régulation ne parcourt que les lots présents,
    donc elle n'était plus jamais commandée) ET pour ce qui s'est allumé en dehors du
    pont : Home Assistant, bouton du boîtier, application tierce. Une seule exception :
    ce qu'un lot actif réclame, c'est-à-dire une prise reliée à une recette en cours,
    que le mode soit automatique ou manuel — c'est le propriétaire qui décide.
    """
    a_examiner = set(CFG.prises) | set(_allumees_par_pont)
    for entite in a_examiner:
        if entite in voulues:
            continue
        memo = _allumees_par_pont.get(entite)
        try:
            etat = etat_prise(entite)
        except Exception as e:
            print("pont : prise %s : état illisible (%s)" % (entite, raison(e)), flush=True)
            continue
        if etat != "on":
            with _verrou_plan:
                _allumees_par_pont.pop(entite, None)
            continue
        with _verrou_plan:
            _allumees_par_pont.pop(entite, None)
        try:
            # Aucun frein ici : c'est le sens sûr, il ne doit pas attendre une minute.
            r = commander(entite, False, auto=True)
            if memo:
                motif = "plus rattachée à aucun lot actif"
                lot = {"id": memo.get("lot"), "nom": memo.get("nom")}
            else:
                motif = "allumée alors qu'aucune recette en cours ne la réclame"
                lot = {"id": None, "nom": "hors recette"}
            noter(
                lot,
                "%s : arrêt — %s (état relu : %s)" % (entite, motif, r.get("etat")),
                entite,
                False,
            )
            sauver_etat()
        except Exception as e:
            if memo:
                with _verrou_plan:
                    _allumees_par_pont[entite] = memo
            print(
                "pont : arrêt de %s impossible (%s) — nouvelle tentative au tour suivant"
                % (entite, raison(e)),
                flush=True,
            )


def boucle_regulation():
    """Un tour de régulation : relire la vérité, mesurer, décider, commander.

    Le plan n'est plus déposé par une page : il est déduit du document partagé, au
    plus une fois par tour. Un document illisible ne coupe rien tout de suite — il
    cesse seulement de repousser l'échéance de sécurité, au bout de dix minutes.
    """
    rafraichir_plan()
    with _verrou_plan:
        lots = [dict(l) for l in _plan["lots"]]
        sans_mesure = _plan["sans_mesure_max"] or CFG.sans_mesure_max * 60
    # Ce que les lots actifs réclament à cet instant — le reste de ce que le pont a
    # allumé est orphelin et se coupe.
    voulues = set()
    for l in lots:
        if l.get("actif"):
            voulues.update(l.get("prises") or [])
    couper_orphelines(voulues)
    for lot in lots:
        try:
            tour_lot(lot, sans_mesure)
        except Exception as e:
            # La panne d'un lot ne doit pas empêcher les autres d'être tenus : sans ce
            # filet, une lecture impossible faisait sauter tout le tour.
            noter(lot, "tour impossible (%s) — aucune commande" % raison(e))


def tour_lot(lot, sans_mesure):
    """Mesure, décide et commande pour un seul lot."""
    # Une fin de lot prévue coupe la chauffe même si la sonde se porte bien.
    alumees = [p for p in lot["prises"] if etat_prise(p) == "on"]
    if lot.get("fin") is not None and time.time() >= lot["fin"]:
        for p in alumees:
            commander_regule(lot, p, False, "fin de lot prévue atteinte")
        return
    if not lot["actif"]:
        return
    mesure = lire_sonde(lot["sonde"])
    # Une sonde d'humidité ne dit pas la température : on refuse de chauffer sur elle.
    unite = (mesure.get("unite") or "").replace("°", "").strip().upper()
    if unite and unite not in ("C", "CELSIUS", "K", "KELVIN"):
        if alumees:
            for p in alumees:
                commander_regule(lot, p, False, "sonde non thermique (%s)" % mesure.get("unite"))
        return
    age = mesure["age"]
    if mesure["valeur"] is None:
        # Home Assistant ne sait plus rien de cette sonde (unavailable, unknown) : le
        # délai court depuis sa dernière nouvelle, et c'est celui que le propriétaire a
        # fixé. Couper sur un hoquet de trois secondes n'aurait aucun sens.
        if alumees and (age is None or age > sans_mesure):
            motif = "sonde sans nouvelle depuis %d min" % int((age or 0) // 60) if age is not None \
                else "sonde sans valeur ni horodatage"
            for p in alumees:
                commander_regule(lot, p, False, motif)
        return
    if age is not None and age > FRAICHEUR_TOLEREE:
        # Valeur toujours disponible mais plus rafraîchie depuis longtemps : la sonde
        # est probablement morte en gardant sa dernière valeur (mesuré sur le parc réel :
        # une sonde annonçait 26,9 °C avec un horodatage vieux de vingt-cinq jours).
        if alumees:
            for p in alumees:
                commander_regule(lot, p, False, "mesure figée depuis %d min" % int(age // 60))
        return
    if age is not None and age > sans_mesure:
        # Entre les deux : soit la sonde est morte, soit elle est simplement stable, et
        # Home Assistant ne permet pas de trancher. On ne coupe pas tout de suite, mais
        # on cesse de repousser l'échéance — le plafond de chauffe fera le travail — et
        # on le dit une fois, pour que ce ne soit pas silencieux.
        if alumees and not lot.get("_figee_dite"):
            lot["_figee_dite"] = True
            noter(lot, "mesure non rafraîchie depuis %d min — plus d'échéance repoussée, "
                       "coupure au plafond de chauffe" % int(age // 60))
        return
    v, c, h = mesure["valeur"], lot["consigne"], lot["ecart"]
    if v < c - h and not alumees:
        # Allumer est refusé tant que l'échéance est gelée (document partagé illisible
        # depuis plus de dix minutes). Sans cette réserve, le plafond de chauffe coupait
        # la prise, puis le tour suivant la rallumait parce que la température était
        # toujours basse : la chauffe se réarmait indéfiniment par cycles, et le plafond
        # ne plafonnait plus rien. On ne commande pas une chauffe neuve sur un plan que
        # plus personne ne peut contredire.
        if echeance_gelee():
            if not lot.get("_gel_dit"):
                lot["_gel_dit"] = True
                noter(
                    lot,
                    "%.1f °C sous la consigne %.1f °C, mais document partagé illisible "
                    "— aucune chauffe engagée" % (v, c),
                )
            return
        lot["_gel_dit"] = False
        for p in lot["prises"]:
            commander_regule(lot, p, True, "%.1f °C, sous la consigne %.1f °C" % (v, c))
    elif v > c + h and alumees:
        for p in alumees:
            commander_regule(lot, p, False, "%.1f °C, au-dessus de la consigne %.1f °C" % (v, c))
    elif alumees and not echeance_gelee():
        # Décision « on continue de chauffer », et mesure fraîche : on repousse l'échéance
        # de sécurité, sinon une chauffe longue et légitime serait coupée par le garde-fou
        # des PONT_CHAUFFE_MAX minutes alors que le pont la surveille de près.
        # Une seule réserve, ajoutée par le §4.5 : si le document partagé est illisible
        # depuis plus de dix minutes, le plan qu'on tient n'est plus contredisible par
        # personne — on cesse alors de repousser, et le plafond de chauffe coupe.
        with _verrou_echeances:
            for p in alumees:
                if p in _echeances:
                    _echeances[p] = time.time() + CFG.chauffe_max * 60


def regulation():
    """Tourne tant que le pont vit : la page peut disparaître, pas la consigne."""
    print(
        "pont : régulation active — un tour toutes les %d s, coupure si la sonde se "
        "tait plus de %d min (PONT_SANS_MESURE_MAX)" % (PERIODE_REGULATION, CFG.sans_mesure_max),
        flush=True,
    )
    while True:
        try:
            boucle_regulation()
        except Exception as e:
            # Une panne de Home Assistant ne doit pas tuer le fil : on réessaiera.
            print("pont : tour de régulation interrompu (%s) — reprise" % raison(e), flush=True)
        time.sleep(PERIODE_REGULATION)


def surveillance():
    """Coupe les chauffes automatiques que personne n'a décommandées.

    Sans cette surveillance, une chauffe lancée par une page resterait allumée pour
    toujours si cette page disparaît : c'est le seul défaut qu'une page ne peut pas
    corriger, le pont si.
    """
    if CFG.chauffe_max <= 0:
        print("pont : surveillance des chauffes désactivée (PONT_CHAUFFE_MAX=0)", flush=True)
        return
    print(
        "pont : surveillance des chauffes automatiques — arrêt forcé après %d min"
        % CFG.chauffe_max,
        flush=True,
    )
    while True:
        maintenant = time.time()
        for entite, echeance in list(_echeances.items()):
            if maintenant < echeance:
                continue
            with _verrou_echeances:
                if _echeances.get(entite) != echeance:
                    continue
                _echeances.pop(entite, None)
            try:
                if etat_prise(entite) != "on":
                    # L'échéance n'a plus d'objet : une prise déjà éteinte n'a pas été
                    # « interrompue ». Ne pas écrire au journal une coupure qui n'a pas eu
                    # lieu — un motif faux envoie chercher la panne au mauvais endroit.
                    print("pont : échéance de %s levée — déjà à l'arrêt" % entite, flush=True)
                    continue
                r = commander(entite, False)
                print(
                    "pont : chauffe automatique de %s interrompue après %d min (état relu : %s)"
                    % (entite, CFG.chauffe_max, r.get("etat")),
                    flush=True,
                )
            except Exception as e:
                # Home Assistant muet : on retente dans deux minutes plutôt que de
                # perdre l'échéance et de laisser la prise allumée.
                with _verrou_echeances:
                    _echeances[entite] = time.time() + 120
                print(
                    "pont : arrêt de sécurité de %s impossible (%s) — nouvelle tentative dans 2 min"
                    % (entite, raison(e)),
                    flush=True,
                )
        time.sleep(PERIODE_SURVEILLANCE)


class Handler(BaseHTTPRequestHandler):
    server_version = "pont-scada"
    sys_version = ""
    # Un client qui annonce un corps puis ne l'envoie jamais ne doit pas immobiliser
    # un thread indéfiniment.
    timeout = DELAI_CLIENT

    def repond(self, code, charge=None, texte=None):
        if texte is None:
            # allow_nan=False : mieux vaut une erreur locale qu'un JSON invalide qui
            # ferait tomber tout l'affichage du navigateur.
            texte = json.dumps(charge, ensure_ascii=False, allow_nan=False)
            type_mime = "application/json; charset=utf-8"
        else:
            type_mime = "text/plain; charset=utf-8"
        return self.envoyer(code, texte.encode("utf-8"), type_mime)

    def repond_octets(self, code, corps):
        """Renvoie du JSON déjà sérialisé : le document stocké, tel quel.

        C'est ainsi que le pont sert le document sans l'analyser pour le rendre — et
        sans en construire une seconde copie en mémoire à chaque lecture.
        """
        return self.envoyer(code, corps, "application/json; charset=utf-8")

    def envoyer(self, code, corps, type_mime):
        self.send_response(code)
        self.send_header("Content-Type", type_mime)
        self.send_header("Content-Length", str(len(corps)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(corps)

    def autentifie(self):
        # Mode sans authentification, choisi explicitement (PONT_AUTH=aucune).
        if CFG.auth == "aucune":
            return True
        entete = self.headers.get("Authorization") or ""
        # Comparaison à temps constant : le jeton ne se devine pas caractère par caractère.
        return hmac.compare_digest(entete.strip().encode("utf-8"),
                                   ("Bearer " + CFG.pont_jeton).encode("utf-8"))

    def meme_origine(self):
        """Refuse une requête dont l'Origin ne correspond pas à l'hôte appelé.

        Bloque l'usage depuis une page tierce et le DNS rebinding, sans avoir à
        connaître à l'avance l'adresse utilisée (IP:30090 ou nom d'hôte).
        """
        origine = self.headers.get("Origin")
        if not origine or origine == "null":
            return True
        scheme = origine.split("://", 1)[0].lower()
        # Le port par défaut s'omet des deux côtés : le navigateur écrit
        # « http://hote » là où l'en-tête Host porte parfois « hote:80 ».
        hote_origine = sans_port_defaut(origine.split("//", 1)[-1].rstrip("/"), scheme)
        hote_appele = sans_port_defaut(self.headers.get("Host") or "", scheme)
        return hmac.compare_digest(hote_origine.encode("utf-8"), hote_appele.encode("utf-8"))

    def magasin_ouvert(self):
        """Le partage de données n'est servi que sous PONT_AUTH=jeton.

        Avec /api/regul, une écriture hostile était transitoire : la page redéposait
        son plan dans les dix minutes. Avec un document persistant, n'importe quelle
        machine du réseau écrit rev+1, et les pages légitimes adoptent. Une écriture
        non authentifiée deviendrait la destruction définitive de tous les relevés.
        """
        return CFG.auth == "jeton"

    def parametre_depuis(self):
        """Lit « ?depuis=<secondes> ». Un paramètre illisible vaut « tout »."""
        try:
            brut = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            return max(0, int(float((brut.get("depuis") or ["0"])[0])))
        except (ValueError, TypeError):
            return 0

    def donnees_lire(self, sondage):
        """GET /api/donnees et /api/donnees/rev.

        « sondage » : la réponse courte, celle que la page appelle toutes les quinze
        secondes. Elle n'analyse pas le document — en régime stable, un stat() suffit.
        """
        try:
            enveloppe = lire_enveloppe()
        except (OSError, ValueError) as e:
            precedent = lire_precedent()
            if precedent is None:
                self.journal("document partagé illisible (%s)" % type(e).__name__)
                return self.repond(507, {"ok": False, "motif": "illisible"})
            # §4.5 : la génération précédente est servie EN LECTURE, avec un
            # avertissement, et toute écriture reste refusée jusqu'à décision de
            # l'exploitant — écrire par-dessus ferait disparaître la cause.
            if sondage:
                return self.repond(
                    200,
                    {
                        "ok": True,
                        "rev": precedent["rev"],
                        "maj": precedent["maj"],
                        "semence": precedent["semence"],
                        "octets": precedent["octets"],
                        "degrade": True,
                        "avertissements": [
                            "document illisible — génération précédente, écriture refusée"
                        ],
                    },
                )
            return self.repond_octets(
                200, b'{"degrade": true, ' + precedent["corps"].lstrip()[1:]
            )
        if enveloppe is None:
            # Document jamais écrit. « semence: null » est ce qui déclenche le sceau
            # d'installation côté page : elle n'entreprend alors plus rien seule.
            if sondage:
                return self.repond(
                    200, {"ok": True, "rev": 0, "maj": 0, "semence": None, "octets": 0}
                )
            return self.repond(
                200, {"ok": True, "rev": 0, "maj": 0, "semence": None, "donnees": None}
            )
        if sondage:
            return self.repond(
                200,
                {
                    "ok": True,
                    "rev": enveloppe["rev"],
                    "maj": enveloppe["maj"],
                    "semence": enveloppe["semence"],
                    # Taille du document stocké, enveloppe comprise : c'est ce que la
                    # page téléchargera si elle demande le document.
                    "octets": enveloppe["octets"],
                },
            )
        return self.repond_octets(200, enveloppe["corps"])

    def donnees_ecrire(self, corps):
        """POST /api/donnees : la seule porte d'entrée de la vérité partagée.

        Le pont refuse ici UNIQUEMENT ce qui est structurellement instockable. Tout ce
        qui ne casse que la régulation est écrit, puis signalé dans
        « avertissements[] » : refuser l'écriture ferait perdre la saisie d'un lot à
        moitié configuré — on reconstruirait la perte de données qu'on corrige.
        """
        if not magasin_present():
            return self.repond(503, {"ok": False, "motif": "stockage"})
        op = corps.get("op")
        if op is not None and (not isinstance(op, str) or len(op) > 64):
            return self.repond(400, {"ok": False, "motif": "op"})
        op = op or ""
        base = corps.get("base")
        # bool est un int en Python : « base: true » n'est pas une révision.
        if not isinstance(base, int) or isinstance(base, bool) or base < 0:
            return self.repond(400, {"ok": False, "motif": "base", "op": op})
        document = corps.get("donnees")
        if not isinstance(document, dict):
            # Non spécifié en v1 : « donnees: null » aurait tout effacé.
            return self.repond(400, {"ok": False, "motif": "donnees", "op": op})
        for cle in document:
            if cle not in CLES_RACINE:
                return self.repond(
                    400, {"ok": False, "motif": "cle", "cle": str(cle)[:64], "op": op}
                )
        reactiver = corps.get("reactiver")
        if reactiver is None:
            reactiver = []
        if not isinstance(reactiver, list) or len(reactiver) > 64:
            return self.repond(400, {"ok": False, "motif": "reactiver", "op": op})
        # « reactiver » n'autorise que ce qu'il nomme : jamais un drapeau global.
        autorises = {x for x in reactiver if isinstance(x, str) and x}
        try:
            # Sérialisé une première fois ici, pour refuser une taille excessive sans
            # prendre le verrou d'écriture. Le document stocké est sérialisé à nouveau
            # une fois le « maj » apposé, et c'est cette taille-là qui fait foi.
            texte = json.dumps(
                document, ensure_ascii=False, allow_nan=False, separators=(",", ":")
            )
        except ValueError:
            # json.loads accepte NaN et Infinity ; les stocker rendrait le document
            # illisible par tout navigateur, pour toujours.
            return self.repond(400, {"ok": False, "motif": "donnees", "op": op})
        if len(texte.encode("utf-8")) > DOCUMENT_MAX:
            return self.repond(
                413, {"ok": False, "motif": "taille", "octets_max": DOCUMENT_MAX, "op": op}
            )
        code, charge = ecrire_donnees(base, op, document, autorises)
        if code == 200 and not charge.get("rejoue"):
            # Le plan suit tout de suite : la page qui vient d'écrire ne doit pas
            # attendre le tour de régulation pour que sa consigne soit tenue.
            rafraichir_plan()
            self.journal(
                "document partagé : révision %d (op %s, %d avertissement(s))"
                % (charge["rev"], op or "—", len(charge.get("avertissements") or []))
            )
        return self.repond(code, charge)

    def journal(self, message):
        print("%s %s" % (time.strftime("%H:%M:%S"), message), flush=True)

    def do_GET(self):
        chemin = self.path.split("?", 1)[0].rstrip("/") or "/"
        # /api/sante est volontairement sans authentification : c'est la sonde de
        # Kubernetes, qui passe par nginx puis la boucle locale.
        if chemin in ("/api/sante", "/sante", "/healthz"):
            return self.repond(200, texte="ok")
        if chemin == "/api/etat":
            if not self.meme_origine():
                return self.repond(403, {"ok": False, "erreur": "origine refusée"})
            if not self.autentifie():
                return self.repond(401, {"ok": False, "erreur": "jeton requis"})
            try:
                return self.repond(200, etat_appareils())
            except Exception as e:
                self.journal("échec lecture état : %s" % raison(e))
                return self.repond(502, {"ok": False, "erreur": "Home Assistant " + raison(e)})
        if chemin in ("/api/donnees", "/api/donnees/rev"):
            if not self.meme_origine():
                return self.repond(403, {"ok": False, "erreur": "origine refusée"})
            if not self.magasin_ouvert():
                return self.repond(503, {"ok": False, "motif": "authentification"})
            if not self.autentifie():
                return self.repond(401, {"ok": False, "erreur": "jeton requis"})
            if not magasin_present():
                return self.repond(503, {"ok": False, "motif": "stockage"})
            return self.donnees_lire(chemin.endswith("/rev"))
        if chemin == "/api/decisions":
            if not self.meme_origine():
                return self.repond(403, {"ok": False, "erreur": "origine refusée"})
            if not self.autentifie():
                return self.repond(401, {"ok": False, "erreur": "jeton requis"})
            if not magasin_present():
                return self.repond(503, {"ok": False, "motif": "stockage"})
            depuis = self.parametre_depuis()
            return self.repond(
                200,
                {
                    "ok": True,
                    "depuis": depuis,
                    "plafond": DECISIONS_SERVIES_MAX,
                    "decisions": decisions_depuis(depuis),
                },
            )
        if chemin == "/api/regul":
            if not self.meme_origine():
                return self.repond(403, {"ok": False, "erreur": "origine refusée"})
            if not self.autentifie():
                return self.repond(401, {"ok": False, "erreur": "jeton requis"})
            with _verrou_plan:
                lots = [
                    {
                        "id": l["id"],
                        "nom": l["nom"],
                        "consigne": l["consigne"],
                        "ecart": l["ecart"],
                        "sonde": l["sonde"],
                        "prises": l["prises"],
                        "fin": l["fin"],
                        "actif": l["actif"],
                    }
                    for l in _plan["lots"]
                ]
                charge = {
                    "ok": True,
                    # « regule » dit à la page qui décide : tant que c'est vrai, elle ne
                    # commande pas, sinon deux régulateurs se contrediraient.
                    #
                    # Ce drapeau dit « le pont EST le régulateur », et non « le pont a du
                    # travail ». Le lier à la présence de lots actifs rendait la page
                    # régulatrice dès que le plan était vide — donc précisément quand un
                    # lot venait d'être EXCLU (quarantaine, recette figée manquante) ou
                    # quand le document était inaccessible. Le navigateur rallumait alors
                    # la prise que le pont coupait vingt secondes plus tard, et le relais
                    # battait. Le pont régule dès qu'il lit la source de vérité.
                    #
                    # Le mode dégradé ne rend PAS la main non plus : le pont tient encore
                    # le plan précédent, et il vient justement de refuser d'engager une
                    # chauffe neuve. Laisser la page commander à cet instant, c'est lui
                    # faire allumer exactement ce que le pont a décidé de ne pas allumer.
                    "regule": _source_plan["lu"] > 0,
                    "recu": int(_plan["recu"]),
                    "sans_mesure_max": int(_plan["sans_mesure_max"] or CFG.sans_mesure_max * 60),
                    "lots": lots,
                    "decisions": list(_decisions)[-40:],
                    # Ce que le document contenait et que le plan a refusé : sans cette
                    # liste, le motif resterait enterré et un lot cesserait de chauffer
                    # sans que personne puisse dire pourquoi.
                    "exclus": list(_source_plan["exclus"]),
                    "source": {
                        "rev": _source_plan["rev"],
                        "maj": _source_plan["maj"],
                        "lu": _source_plan["lu"],
                        "degrade": _source_plan["degrade"],
                    },
                }
            return self.repond(200, charge)
        return self.repond(404, {"ok": False, "erreur": "chemin inconnu"})

    def do_POST(self):
        chemin = self.path.split("?", 1)[0].rstrip("/") or "/"
        if chemin not in ("/api/prise", "/api/regul", "/api/donnees"):
            return self.repond(404, {"ok": False, "erreur": "chemin inconnu"})
        if not self.meme_origine():
            return self.repond(403, {"ok": False, "erreur": "origine refusée"})
        if chemin == "/api/regul":
            # Le plan n'est plus déposé : il est déduit du document partagé. Aucun
            # chemin de secours en écriture n'est conservé — il s'ouvrirait
            # précisément quand personne ne peut vérifier ce qu'un plan contredit.
            #
            # 410 et non 404 : une page ouverte depuis des jours traite un échec de
            # dépôt par un retour muet, et un 404 est indistinguable d'un incident
            # passager. Le 410 lui dit de se recharger. Répondu avant la garde
            # d'authentification, sinon une page sans jeton recevrait un 401 et
            # n'apprendrait jamais que la route a disparu.
            return self.repond(
                410,
                {
                    "ok": False,
                    "motif": "disparu",
                    "erreur": "POST /api/regul a disparu : le plan est déduit du "
                    "document partagé (POST /api/donnees). Rechargez la page.",
                },
            )
        if chemin == "/api/donnees" and not self.magasin_ouvert():
            return self.repond(503, {"ok": False, "motif": "authentification"})
        if not self.autentifie():
            return self.repond(401, {"ok": False, "erreur": "jeton requis"})
        # Un « Content-Type » simple (text/plain, form-urlencoded) permettrait à une
        # page hostile d'envoyer la commande sans pré-vol CORS ; on ne l'accepte pas.
        type_mime = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if type_mime != "application/json":
            return self.repond(
                415, {"ok": False, "erreur": "Content-Type attendu : application/json"}
            )
        try:
            taille = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            taille = 0
        # La limite de corps est propre à chaque route : CORPS_MAX reste celle de
        # /api/prise, le document partagé a la sienne, alignée sur nginx.
        if chemin == "/api/donnees":
            if taille > CORPS_DONNEES_MAX:
                # Refusé ici, avec un motif lisible — et non par nginx avec une page
                # HTML que la page ne sait pas lire.
                return self.repond(
                    413, {"ok": False, "motif": "taille", "octets_max": DOCUMENT_MAX}
                )
            if taille <= 0:
                return self.repond(400, {"ok": False, "erreur": "corps absent"})
        elif taille <= 0 or taille > CORPS_MAX:
            return self.repond(400, {"ok": False, "erreur": "corps absent ou trop volumineux"})
        try:
            corps = json.loads(self.rfile.read(taille).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return self.repond(400, {"ok": False, "erreur": "corps JSON invalide"})
        if not isinstance(corps, dict):
            return self.repond(400, {"ok": False, "erreur": "corps JSON invalide"})
        if chemin == "/api/donnees":
            return self.donnees_ecrire(corps)
        entite = corps.get("entite")
        allume = corps.get("allume")
        if not isinstance(entite, str) or not isinstance(allume, bool):
            return self.repond(
                400, {"ok": False, "erreur": "champs attendus : entite (chaîne), allume (booléen)"}
            )
        if entite not in CFG.prises:
            # Liste blanche : le pont ne peut commander que les prises déclarées.
            return self.repond(403, {"ok": False, "erreur": "entité non autorisée"})
        # « auto » : la commande vient de la régulation du dashboard, pas d'un clic.
        # Seules celles-là sont coupées par la surveillance si elles traînent.
        auto = corps.get("auto") is True
        try:
            reponse = commander(entite, allume, auto)
        except Exception as e:
            self.journal("échec commande %s : %s" % (entite, raison(e)))
            return self.repond(502, {"ok": False, "erreur": "Home Assistant " + raison(e)})
        self.journal(
            "commande %s%s → %s (état relu : %s)"
            % (entite, " (auto)" if auto else "", "on" if allume else "off", reponse["etat"])
        )
        return self.repond(200, reponse)

    def log_message(self, format, *args):  # journal compact, sans jeton
        return


def main():
    CFG.verifier()
    print(
        "pont : écoute sur %s:%d — %d prise(s), %d sonde(s), authentification : %s"
        % (
            CFG.adresse,
            CFG.port,
            len(CFG.prises),
            len(CFG.sondes),
            "aucune (PONT_AUTH=aucune)" if CFG.auth == "aucune"
            else "jeton partagé (%d caractères)" % len(CFG.pont_jeton),
        ),
        flush=True,
    )
    if not magasin_present():
        print(
            "pont : aucun magasin partagé (ni PONT_DONNEES ni PONT_ETAT) — "
            "/api/donnees répond 503 et aucun plan ne sera déduit.",
            file=sys.stderr,
            flush=True,
        )
    else:
        sceau, _semence, rev_max = lire_sceau()
        print(
            "pont : magasins dans %s — document partagé %s, sceau %s"
            % (
                CFG.rep_donnees,
                "présent" if os.path.exists(_ch("donnees.json")) else "jamais écrit",
                "révision max %d" % rev_max if sceau else "absent",
            ),
            flush=True,
        )
        if CFG.auth != "jeton":
            print(
                "pont : PONT_AUTH=%s — /api/donnees répond 503 : un document partagé "
                "sans authentification serait effaçable par toute machine du réseau."
                % CFG.auth,
                file=sys.stderr,
                flush=True,
            )
    threading.Thread(target=surveillance, daemon=True).start()
    # Le plan et les heures de commande sont relus avant que la régulation démarre : un
    # redémarrage ne doit ni perdre la consigne, ni remettre à zéro les échéances.
    charger_etat()
    # La régulation vit dans le pont, pas dans la page : une fermentation dure des
    # jours et personne ne garde un onglet ouvert tout ce temps.
    threading.Thread(target=regulation, daemon=True).start()
    serveur = ThreadingHTTPServer((CFG.adresse, CFG.port), Handler)
    serveur.daemon_threads = True
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        serveur.server_close()


if __name__ == "__main__":
    main()
