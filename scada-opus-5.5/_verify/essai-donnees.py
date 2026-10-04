#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Éprouve le protocole de données partagées du pont (contrat v2).

Vérifie, contre `design/protocole-donnees-partagees-v2.md` (§3 endpoints et
§8 épreuves), que le pont :
  - stocke un document partagé versionné (`GET /api/donnees/rev`, `GET/POST
    /api/donnees`) ;
  - refuse une écriture périmée par 409 sans modifier le document ;
  - rend l'idempotence par le champ `op` (un rejeu ne réécrit pas) ;
  - borne le document à 512 Kio (413) et refuse un corps sans `donnees` (400) ;
  - ferme `/api/donnees` quand `PONT_AUTH=aucune` (503 « authentification ») ;
  - retire `POST /api/regul` (410 Gone, pas 404) ;
  - sert `GET /api/decisions?depuis=0` (liste vide au départ) ;
  - DÉDUIT son plan de régulation du document : un lot actif à 30 °C avec une
    sonde à 20 °C et une prise rattachée allume la prise, archiver le lot la
    coupe — sans qu'aucune page ne soit ouverte ni aucun plan déposé.

Usage (depuis la racine du dépôt) :
    python scada-opus-5.5/_verify/essai-donnees.py

Sortie : un compte d'assertions réussies/échouées ; code de sortie non nul dès
qu'une assertion échoue.

Ce fichier ne dépend de rien : il embarque un faux Home Assistant (état des
entités + journal des commandes reçues), lance le pont (`pont/pont.py`) comme
sous-processus sur des ports libres, et arrête le tout dans un `finally`. Il ne
modifie jamais le pont : s'il échoue parce que les nouveaux endpoints n'existent
pas encore, c'est un résultat attendu et il le rapporte tel quel.

Convention d'installation retenue : le pont est lancé avec `PONT_ETAT` pointant
vers un fichier d'état dans un répertoire temporaire vierge ; c'est dans ce
répertoire que le pont écrit ses données persistantes (donnees.json,
decisions.jsonl, semence.json). L'essai lit tout via HTTP et ne touche jamais
ces fichiers directement.
"""

import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

JETON = "0123456789abcdef0123456789abcdef"   # >= 32 caractères (PONT_JETON)
PRISE = "switch.outlet_4"                     # entité de la liste blanche PONT_PRISES
SONDE = "sensor.sonde1_temperature"           # sonde de température de PONT_SONDES
TAILLE_MAX = 524288                           # 512 Kio

ICI = os.path.dirname(os.path.abspath(__file__))
PONT_PY = os.path.normpath(os.path.join(ICI, "..", "pont", "pont.py"))


# ---------------------------------------------------------------------------
# Faux Home Assistant embarqué : retient l'état des entités et journalise les
# commandes reçues — c'est ce journal qui fait office de preuve (assertions
# 10 et 11). Volontairement silencieux.
# ---------------------------------------------------------------------------
def _iso(t):
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(t)) + "Z"


class FauxHA(BaseHTTPRequestHandler):
    etat = {PRISE: "off", SONDE: "20.0"}
    maj = {SONDE: time.time()}
    journal = []
    verrou = threading.Lock()

    def log_message(self, *a):
        pass

    def rep(self, o, code=200):
        c = json.dumps(o).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(c)))
        self.end_headers()
        self.wfile.write(c)

    def fiche(self, e):
        with FauxHA.verrou:
            s = FauxHA.etat.get(e, "unknown")
            m = FauxHA.maj.get(e, time.time())
        return {"entity_id": e, "state": s, "last_updated": _iso(m),
                "attributes": {"friendly_name": e,
                               "unit_of_measurement": "°C" if e.startswith("sensor") else None}}

    def do_GET(self):
        p = self.path.split("?", 1)[0]
        if p == "/api/":
            return self.rep({})
        if p == "/api/states":
            with FauxHA.verrou:
                noms = list(FauxHA.etat)
            return self.rep([self.fiche(e) for e in noms])
        if p.startswith("/api/states/"):
            return self.rep(self.fiche(p[len("/api/states/"):]))
        if p == "/__journal":
            with FauxHA.verrou:
                return self.rep(list(FauxHA.journal))
        self.rep({"message": "inconnu"}, 404)

    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
            corps = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return self.rep({"message": "corps invalide"}, 400)
        e = corps.get("entity_id") if isinstance(corps, dict) else None
        if self.path.endswith("/turn_on"):
            etat = "on"
        elif self.path.endswith("/turn_off"):
            etat = "off"
        else:
            return self.rep({"message": "service inconnu"}, 404)
        with FauxHA.verrou:
            FauxHA.etat[e] = etat
            FauxHA.journal.append({"t": time.strftime("%H:%M:%S"), "entite": e, "vers": etat})
        self.rep([])


# ---------------------------------------------------------------------------
# Utilitaires HTTP et compteurs d'assertions.
# ---------------------------------------------------------------------------
def port_libre():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def appel(url, methode="GET", corps=None, jeton=None):
    entetes = {"Content-Type": "application/json"}
    if jeton is not None:
        entetes["Authorization"] = "Bearer " + jeton
    donnees = json.dumps(corps).encode("utf-8") if corps is not None else None
    r = urllib.request.Request(url, data=donnees, method=methode, headers=entetes)
    try:
        with urllib.request.urlopen(r, timeout=20) as rep:
            statut, brut = rep.status, rep.read()
    except urllib.error.HTTPError as e:
        statut = e.code
        try:
            brut = e.read()
        except Exception:
            # Le pont peut répondre (ex. 404/413) sans lire le corps, puis
            # fermer la connexion : la lecture de la réponse échoue alors.
            brut = b""
    except Exception as e:
        return {"statut": 0, "corps": None, "erreur": type(e).__name__}
    try:
        charge = json.loads(brut.decode("utf-8")) if brut else None
    except ValueError:
        charge = None
    return {"statut": statut, "corps": charge}


REUSSIES = 0
ECHECS = 0


def verifie(cond, num, nom, detail=""):
    global REUSSIES, ECHECS
    if cond:
        REUSSIES += 1
        print("  OK   %2d) %s" % (num, nom))
    else:
        ECHECS += 1
        print("  KO   %2d) %s%s" % (num, nom, (" — " + detail) if detail else ""))


def attendre_commande(faux_url, entite, vers, limite):
    """Scrute le journal du faux HA jusqu'à voir la commande voulue (jamais
    une durée fixe : c'est la preuve qui décide, pas une horloge)."""
    debut = time.time()
    while time.time() - debut < limite:
        j = appel(faux_url + "/__journal")["corps"] or []
        for c in reversed(j):
            if isinstance(c, dict) and c.get("entite") == entite and c.get("vers") == vers:
                return c
        time.sleep(1)
    return None


def attendre_pont(base_url, limite=15):
    debut = time.time()
    while time.time() - debut < limite:
        if appel(base_url + "/api/sante")["statut"] == 200:
            return True
        time.sleep(0.5)
    return False


def arreter(p):
    if p.poll() is None:
        p.terminate()
        try:
            p.wait(timeout=5)
        except Exception:
            p.kill()


def fin_du_journal(chemin, n=15):
    try:
        with open(chemin, encoding="utf-8", errors="replace") as f:
            lignes = [l.rstrip("\n") for l in f.readlines()]
        return lignes[-n:]
    except OSError:
        return []


# ---------------------------------------------------------------------------
# Documents du test : un lot actif (consigne 30 °C, sonde à 20 °C, prise
# rattachée), puis le même lot archivé (status « done », la convention du
# dashboard pour un lot terminé/archivé).
# ---------------------------------------------------------------------------
def document(statut):
    return {
        "recettes": [{"id": "r1", "name": "Saison du Nord", "type": "biere",
                      "duration": 21, "temp": 30}],
        "lots": [{
            "id": "b1", "name": "Seau 4 L", "start": int(time.time() * 1000),
            "status": statut,
            "recipe": {"temp": 30, "tol": 0.2, "duration": 10},
            "recipeId": "r1",
        }],
        "appareils": [
            {"id": "o1", "eid": PRISE, "kind": "plug", "batch": "b1"},
            {"id": "s1", "eid": SONDE, "kind": "temp", "batch": "b1"},
        ],
        "reglages": {},
    }


def lot_actif(doc):
    if not isinstance(doc, dict):
        return False
    for l in doc.get("lots") or []:
        if isinstance(l, dict) and l.get("id") == "b1" and l.get("status") == "active":
            r = l.get("recipe")
            if isinstance(r, dict) and r.get("temp") == 30:
                return True
    return False


def appareils_ok(doc):
    if not isinstance(doc, dict):
        return False
    apps = [a for a in (doc.get("appareils") or []) if isinstance(a, dict)]
    plug = any(a.get("eid") == PRISE and a.get("kind") == "plug" and a.get("batch") == "b1" for a in apps)
    sonde = any(a.get("eid") == SONDE and a.get("kind") == "temp" and a.get("batch") == "b1" for a in apps)
    return plug and sonde


# ---------------------------------------------------------------------------
# Déroulement.
# ---------------------------------------------------------------------------
def main():
    racine = tempfile.mkdtemp(prefix="essai-donnees-")
    dir_etat = os.path.join(racine, "etat")
    os.makedirs(dir_etat, exist_ok=True)
    fichier_etat = os.path.join(dir_etat, "etat.json")

    port_ha = port_libre()
    faux_url = "http://127.0.0.1:%d" % port_ha
    serveur_ha = ThreadingHTTPServer(("127.0.0.1", port_ha), FauxHA)
    serveur_ha.daemon_threads = True
    threading.Thread(target=serveur_ha.serve_forever, daemon=True).start()

    def lancer_pont(port, auth):
        env = dict(os.environ)
        env.update({
            "HASS_URL": faux_url,
            "HASS_TOKEN": "faux-jeton-ha",
            "PONT_AUTH": auth,
            "PONT_PRISES": PRISE,
            "PONT_SONDES": SONDE,
            "PONT_CHAUFFE_MAX": "90",
            "PONT_SANS_MESURE_MAX": "15",
            "PONT_PORT": str(port),
            "PONT_ADRESSE": "127.0.0.1",
            "PONT_ETAT": fichier_etat,
        })
        if auth == "jeton":
            env["PONT_JETON"] = JETON
        log = os.path.join(racine, "pont-%s-%d.log" % (auth, port))
        f = open(log, "wb")
        p = subprocess.Popen([sys.executable, PONT_PY], env=env,
                             stdout=f, stderr=subprocess.STDOUT)
        return p, f, log

    ponts = []  # (processus, descripteur de journal, chemin de journal)
    try:
        print("=== essai du protocole de données partagées (contrat v2) ===")
        print("pont testé          : %s" % PONT_PY)
        print("faux Home Assistant : %s" % faux_url)
        print()

        # ---- phase 1 : PONT_AUTH=jeton (le mode nominal) -----------------
        port_pont = port_libre()
        pont_url = "http://127.0.0.1:%d" % port_pont
        p, f, log = lancer_pont(port_pont, "jeton")
        ponts.append((p, f, log))
        if not attendre_pont(pont_url):
            print("  !! le pont ne répond pas sur /api/sante (voir %s)" % log)
        print("phase 1 : PONT_AUTH=jeton sur %s" % pont_url)

        # 1) GET /api/donnees/rev sur un pont neuf -> rev 0.
        #    En mode jeton, toute la famille /api/donnees* exige l'en-tête
        #    Authorization (401 sans lui) : on le fournit.
        r = appel(pont_url + "/api/donnees/rev", jeton=JETON)
        rev0 = (r["corps"] or {}).get("rev") if isinstance(r["corps"], dict) else None
        verifie(r["statut"] == 200 and rev0 == 0, 1,
                "GET /api/donnees/rev sur pont neuf -> rev 0",
                "statut=%s rev=%s" % (r["statut"], rev0))

        # 9) GET /api/decisions?depuis=0 -> liste de décisions vide au départ.
        #    Le contrat (§2.C) ne fige pas l'enveloppe : on attend, comme pour les
        #    autres routes /api, un objet {ok, decisions:[...]} — la liste est vide.
        d = appel(pont_url + "/api/decisions?depuis=0", jeton=JETON)
        decisions = (d["corps"] or {}).get("decisions") if isinstance(d["corps"], dict) else None
        verifie(d["statut"] == 200 and isinstance(decisions, list) and len(decisions) == 0, 9,
                "GET /api/decisions?depuis=0 -> liste vide",
                "statut=%s decisions=%s" % (d["statut"], type(decisions).__name__))

        # 5) corps sans le champ donnees -> 400.
        r = appel(pont_url + "/api/donnees", "POST", {"base": 0, "op": "op-sans"}, JETON)
        verifie(r["statut"] == 400 and (r["corps"] or {}).get("motif") == "donnees", 5,
                "POST sans le champ donnees -> 400",
                "statut=%s motif=%s" % (r["statut"], (r["corps"] or {}).get("motif")))

        # 6) corps de plus de 512 Kio -> 413.
        gros = {"recettes": [], "lots": [], "appareils": [],
                "reglages": {"blob": "x" * 525000}}
        r = appel(pont_url + "/api/donnees", "POST", {"base": 0, "op": "op-gros", "donnees": gros}, JETON)
        verifie(r["statut"] == 413 and (r["corps"] or {}).get("motif") == "taille", 6,
                "POST corps > 512 Kio -> 413",
                "statut=%s motif=%s" % (r["statut"], (r["corps"] or {}).get("motif")))

        # 2) POST valide base 0 écrit le document (révision supérieure),
        #    puis GET relit ce document.
        doc_actif = document("active")
        r = appel(pont_url + "/api/donnees", "POST",
                  {"base": 0, "op": "op1", "donnees": doc_actif}, JETON)
        rev1 = (r["corps"] or {}).get("rev") if isinstance(r["corps"], dict) else None
        ecrit = r["statut"] == 200 and isinstance(rev1, int) and rev1 > 0
        g = appel(pont_url + "/api/donnees", jeton=JETON)
        donnees = (g["corps"] or {}).get("donnees")
        relu = g["statut"] == 200 and lot_actif(donnees) and appareils_ok(donnees)
        verifie(ecrit and relu, 2,
                "POST valide base 0 écrit (rev>0), GET relit le document",
                "écriture statut=%s rev=%s, relecture statut=%s" % (r["statut"], rev1, g["statut"]))

        # 3) second POST avec base périmé -> 409, document inchangé (relu).
        doc_archive = document("done")
        r = appel(pont_url + "/api/donnees", "POST",
                  {"base": 0, "op": "op-perime", "donnees": doc_archive}, JETON)
        g = appel(pont_url + "/api/donnees", jeton=JETON)
        donnees2 = (g["corps"] or {}).get("donnees")
        rev2 = (g["corps"] or {}).get("rev")
        inchanged = lot_actif(donnees2)   # toujours le lot actif, pas l'archivé
        verifie(r["statut"] == 409 and inchanged and rev2 == rev1, 3,
                "POST base périmé -> 409, document inchangé",
                "statut=%s rev avant=%s après=%s" % (r["statut"], rev1, rev2))

        # 4) rejouer le même POST (même op) -> 200 idempotent, pas de réécriture.
        r = appel(pont_url + "/api/donnees", "POST",
                  {"base": 0, "op": "op1", "donnees": doc_actif}, JETON)
        g = appel(pont_url + "/api/donnees", jeton=JETON)
        rev3 = (g["corps"] or {}).get("rev")
        verifie(r["statut"] == 200 and rev3 == rev1, 4,
                "rejouer le même op -> 200 idempotent, rev non réécrit",
                "statut=%s rev=%s (attendu %s)" % (r["statut"], rev3, rev1))

        # 8) POST /api/regul -> 410 (Gone), pas 404.
        r = appel(pont_url + "/api/regul", "POST", {}, JETON)
        verifie(r["statut"] == 410, 8,
                "POST /api/regul -> 410 (supprimé, pas 404)",
                "statut=%s" % r["statut"])

        # 10) plan DÉDUIT : le lot actif (30 °C, sonde 20 °C, prise rattachée)
        #     allume la prise sans qu'aucune page ne soit ouverte ni aucun plan
        #     déposé. Preuve = commande reçue par le faux Home Assistant.
        c = attendre_commande(faux_url, PRISE, "on", 75)
        verifie(c is not None, 10,
                "plan déduit : lot actif 30°C / sonde 20°C -> prise allumée",
                "commande observée=%s" % (json.dumps(c) if c else "aucune"))

        # 11) en archivant le lot dans le document, le pont coupe la prise.
        rv = appel(pont_url + "/api/donnees/rev", jeton=JETON)
        base = (rv["corps"] or {}).get("rev", 0) if isinstance(rv["corps"], dict) else 0
        r = appel(pont_url + "/api/donnees", "POST",
                  {"base": base, "op": "op-archive", "donnees": doc_archive}, JETON)
        c = attendre_commande(faux_url, PRISE, "off", 60)
        verifie(c is not None, 11,
                "lot archivé -> prise coupée",
                "écriture statut=%s, commande=%s" % (r["statut"], json.dumps(c) if c else "aucune"))

        arreter(p)
        f.close()

        # ---- phase 2 : PONT_AUTH=aucune ---------------------------------
        port_pont2 = port_libre()
        pont_url2 = "http://127.0.0.1:%d" % port_pont2
        p2, f2, log2 = lancer_pont(port_pont2, "aucune")
        ponts.append((p2, f2, log2))
        attendre_pont(pont_url2)
        print("phase 2 : PONT_AUTH=aucune sur %s" % pont_url2)

        # 7) PONT_AUTH=aucune -> /api/donnees répond 503 (authentification).
        r = appel(pont_url2 + "/api/donnees")
        verifie(r["statut"] == 503 and (r["corps"] or {}).get("motif") == "authentification", 7,
                "PONT_AUTH=aucune -> /api/donnees 503 (authentification)",
                "statut=%s motif=%s" % (r["statut"], (r["corps"] or {}).get("motif")))

        arreter(p2)
        f2.close()
    finally:
        for p, f, log in ponts:
            arreter(p)
            try:
                f.close()
            except Exception:
                pass
        serveur_ha.shutdown()
        serveur_ha.server_close()

    print()
    print("---")
    print("Réussies : %d | Échouées : %d | Total : %d" % (REUSSIES, ECHECS, REUSSIES + ECHECS))
    if ECHECS:
        print("VERDICT : ÉCHEC — %d assertion(s) en échec." % ECHECS)
        for p, f, log in ponts:
            queue = fin_du_journal(log)
            if queue:
                print("--- fin du journal du pont (%s) ---" % log)
                for ligne in queue:
                    print("  " + ligne)
    else:
        print("VERDICT : SUCCÈS — les %d assertions passent." % REUSSIES)
    shutil.rmtree(racine, ignore_errors=True)
    sys.exit(1 if ECHECS else 0)


if __name__ == "__main__":
    main()
