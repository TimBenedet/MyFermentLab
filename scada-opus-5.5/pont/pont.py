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

Bibliothèque standard uniquement : aucune dépendance à installer.
"""

import datetime
import hmac
import json
import math
import os
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DELAI_HA = 8.0              # secondes, par opération de socket vers Home Assistant
DELAI_CLIENT = 10.0         # secondes : un client qui n'envoie pas son corps est coupé
CORPS_MAX = 4096            # octets, taille maximale acceptée sur /api/prise
CACHE_ETAT = 2.0            # secondes, pour ne pas marteler Home Assistant
APPELS_SIMULTANES = 4       # appels à Home Assistant en parallèle, au maximum
JETON_MIN = 32              # caractères ; en dessous, refus de démarrer


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
# Le navigateur reste le poste de réglage : il dépose un plan (consigne, sonde,
# prises, fin prévue) et lit ce que le pont a décidé. Le pont, lui, ne commande
# jamais autre chose que les prises de sa liste blanche, même si un plan en
# désigne d'autres : c'est la liste blanche qui garde la main, pas le plan.
# ---------------------------------------------------------------------------
_verrou_plan = threading.Lock()
_plan = {"lots": [], "recu": 0.0, "sans_mesure_max": 0}
_decisions = []
_derniere_commande = {}
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
    """Retient une décision, pour que la page puisse dire ce que le pont a fait."""
    with _verrou_plan:
        _decisions.append(
            {
                "t": int(time.time()),
                "lot": lot.get("id"),
                "nom": lot.get("nom"),
                "entite": entite,
                "allume": allume,
                "x": message,
            }
        )
        del _decisions[:-DECISIONS_MAX]
    print("pont : régulation — %s : %s" % (lot.get("nom"), message), flush=True)


def commander_regule(lot, entite, allume, motif):
    """Commande une prise du plan, au plus une fois par minute et par prise."""
    maintenant = time.time()
    with _verrou_plan:
        if maintenant - _derniere_commande.get(entite, 0.0) < 60:
            return False
        _derniere_commande[entite] = maintenant
    r = commander(entite, allume, auto=True)
    noter(lot, "%s : %s — %s" % (entite, "chauffe" if allume else "arrêt", motif), entite, allume)
    sauver_etat()
    return r.get("etat") == ("on" if allume else "off")


def boucle_regulation():
    """Un tour de régulation : mesurer, décider, commander. Sans page ouverte."""
    with _verrou_plan:
        lots = [dict(l) for l in _plan["lots"]]
        sans_mesure = _plan["sans_mesure_max"] or CFG.sans_mesure_max * 60
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
        for p in lot["prises"]:
            commander_regule(lot, p, True, "%.1f °C, sous la consigne %.1f °C" % (v, c))
    elif v > c + h and alumees:
        for p in alumees:
            commander_regule(lot, p, False, "%.1f °C, au-dessus de la consigne %.1f °C" % (v, c))
    elif alumees:
        # Décision « on continue de chauffer », et mesure fraîche : on repousse l'échéance
        # de sécurité, sinon une chauffe longue et légitime serait coupée par le garde-fou
        # des PONT_CHAUFFE_MAX minutes alors que le pont la surveille de près.
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
        corps = texte.encode("utf-8")
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
                    "regule": any(l["actif"] for l in _plan["lots"]),
                    "recu": int(_plan["recu"]),
                    "sans_mesure_max": int(_plan["sans_mesure_max"] or CFG.sans_mesure_max * 60),
                    "lots": lots,
                    "decisions": list(_decisions)[-40:],
                }
            return self.repond(200, charge)
        return self.repond(404, {"ok": False, "erreur": "chemin inconnu"})

    def do_POST(self):
        chemin = self.path.split("?", 1)[0].rstrip("/") or "/"
        if chemin not in ("/api/prise", "/api/regul"):
            return self.repond(404, {"ok": False, "erreur": "chemin inconnu"})
        if not self.meme_origine():
            return self.repond(403, {"ok": False, "erreur": "origine refusée"})
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
        if taille <= 0 or taille > CORPS_MAX:
            return self.repond(400, {"ok": False, "erreur": "corps absent ou trop volumineux"})
        try:
            corps = json.loads(self.rfile.read(taille).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return self.repond(400, {"ok": False, "erreur": "corps JSON invalide"})
        if not isinstance(corps, dict):
            return self.repond(400, {"ok": False, "erreur": "corps JSON invalide"})
        if chemin == "/api/regul":
            # Plan de régulation déposé par la page. Le pont ne l'exécute que sur ses
            # prises et ses sondes de liste blanche : un plan hostile ne peut rien
            # commander d'autre, il est refusé.
            lots = corps.get("lots")
            if not isinstance(lots, list) or len(lots) > 32:
                return self.repond(
                    400, {"ok": False, "erreur": "champ lots : liste de 32 lots au plus"}
                )
            propres, refus = [], []
            for i, brut in enumerate(lots):
                lot, motif = valider_lot(brut, i)
                if lot is None:
                    refus.append(motif)
                else:
                    propres.append(lot)
            # Tout ou rien : un plan à moitié accepté serait un plan faux, et la page
            # croirait la consigne tenue alors qu'un lot manquerait à l'appel.
            if refus:
                return self.repond(400, {"ok": False, "erreur": "plan refusé", "refus": refus})
            smm = nombre(corps.get("sans_mesure_max"))
            if smm is None:
                smm = float(CFG.sans_mesure_max * 60)
            # Bornes dures : moins d'une minute serait intenable, plus de deux heures
            # reviendrait à ne plus couper du tout.
            smm = int(max(60.0, min(7200.0, smm)))
            with _verrou_plan:
                change = _plan["lots"] != propres or _plan["sans_mesure_max"] != smm
                _plan["lots"] = propres
                _plan["recu"] = time.time()
                _plan["sans_mesure_max"] = smm
            sauver_etat()
            # La page redépose son plan régulièrement (un pont redémarré l'aurait perdu) :
            # on ne journalise que quand il change vraiment, sinon le journal déborde.
            if change:
                self.journal(
                    "plan de régulation : %d lot(s), %d actif(s), coupure si la sonde se tait "
                    "plus de %d min"
                    % (len(propres), sum(1 for l in propres if l["actif"]), smm // 60)
                )
            return self.repond(
                200,
                {
                    "ok": True,
                    "regule": any(l["actif"] for l in propres),
                    "lots": len(propres),
                    "sans_mesure_max": smm,
                },
            )
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
