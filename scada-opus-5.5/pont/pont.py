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
  PONT_JETON      secret partagé exigé sur /api/etat et /api/prise : OBLIGATOIRE,
                  au moins 32 caractères. Sans lui, n'importe quel appareil du
                  réseau — ou une page hostile — pourrait commander les prises.
  PONT_PRISES     liste blanche des prises commandables, séparées par des virgules
  PONT_SONDES     appareils de mesure remontés, séparés par des virgules
  PONT_BATTERIES  correspondance « mesure=batterie », séparée par des virgules
  PONT_ADRESSE    adresse d'écoute (défaut 127.0.0.1 : boucle locale du pod)
  PONT_PORT       port d'écoute (défaut 8080)

Bibliothèque standard uniquement : aucune dépendance à installer.
"""

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
        self.prises = liste(os.environ.get("PONT_PRISES"))
        self.sondes = liste(os.environ.get("PONT_SONDES"))
        self.batteries = dict(
            p.split("=", 1) for p in liste(os.environ.get("PONT_BATTERIES")) if "=" in p
        )
        self.adresse = os.environ.get("PONT_ADRESSE") or "127.0.0.1"
        self.port = int(os.environ.get("PONT_PORT") or 8080)

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
        # Le mode « sans jeton » n'existe plus : il ouvrait la commande des prises à
        # tout le réseau local, y compris à une page web hostile (requête simple,
        # sans pré-vol CORS). Un jeton absent est une erreur de configuration, pas
        # un mode de fonctionnement.
        if len(self.pont_jeton) < JETON_MIN:
            raise SystemExit(
                "pont : PONT_JETON est absent ou trop court (%d caractères, %d exigés). "
                "Le pont commande des prises physiques : refus de démarrer sans "
                "authentification." % (len(self.pont_jeton), JETON_MIN)
            )
        if not self.prises:
            raise SystemExit(
                "pont : PONT_PRISES est vide — aucune prise ne serait commandable ; "
                "configuration refusée."
            )
        if self.adresse not in ("127.0.0.1", "localhost", "::1"):
            print(
                "pont : ATTENTION écoute sur %s — le pont ne devrait être joignable que "
                "par nginx (PONT_ADRESSE=127.0.0.1)" % self.adresse,
                file=sys.stderr,
            )


CFG = Config()
_verrou_etat = threading.Lock()
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


def commander(entite, allume):
    """Commande une prise de la liste blanche, puis relit son état réel.

    Les multiprises Tuya renvoient souvent l'ancien état juste après la commande :
    on relit donc jusqu'à trois fois, et on n'invalide le cache qu'après coup (un
    /api/etat concurrent pourrait sinon le regarnir avec l'état d'avant).
    """
    service = "turn_on" if allume else "turn_off"
    # Le nom du service est choisi ici, jamais fourni par l'appelant ; l'entité a déjà
    # été validée contre la liste blanche : aucune injection possible.
    appel_ha("/api/services/switch/" + service, "POST", {"entity_id": entite})
    attendu = "on" if allume else "off"
    etat, confirme = None, False
    # Les multiprises Tuya continuent d'annoncer l'ancien état une à trois secondes :
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
    return {"ok": True, "entite": entite, "etat": etat, "confirme": confirme}


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
        return self.repond(404, {"ok": False, "erreur": "chemin inconnu"})

    def do_POST(self):
        chemin = self.path.split("?", 1)[0].rstrip("/") or "/"
        if chemin != "/api/prise":
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
        entite = corps.get("entite")
        allume = corps.get("allume")
        if not isinstance(entite, str) or not isinstance(allume, bool):
            return self.repond(
                400, {"ok": False, "erreur": "champs attendus : entite (chaîne), allume (booléen)"}
            )
        if entite not in CFG.prises:
            # Liste blanche : le pont ne peut commander que les prises déclarées.
            return self.repond(403, {"ok": False, "erreur": "entité non autorisée"})
        try:
            reponse = commander(entite, allume)
        except Exception as e:
            self.journal("échec commande %s : %s" % (entite, raison(e)))
            return self.repond(502, {"ok": False, "erreur": "Home Assistant " + raison(e)})
        self.journal(
            "commande %s → %s (état relu : %s)"
            % (entite, "on" if allume else "off", reponse["etat"])
        )
        return self.repond(200, reponse)

    def log_message(self, format, *args):  # journal compact, sans jeton
        return


def main():
    CFG.verifier()
    print(
        "pont : écoute sur %s:%d — %d prise(s), %d sonde(s), authentification : jeton partagé "
        "(%d caractères)"
        % (CFG.adresse, CFG.port, len(CFG.prises), len(CFG.sondes), len(CFG.pont_jeton)),
        flush=True,
    )
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
