"""D3 — mode dégradé : la page doit se GELER, pas adopter une révision plus vieille.

Quand le document courant devient illisible, le pont sert la génération précédente avec sa
propre révision : la révision RECULE (8 -> 7). Si la page ne lit pas le drapeau `degrade`,
elle voit une révision différente de la sienne, télécharge, et adopte un document plus
vieux que le sien — pendant que toute écriture est refusée en 507. Au retour à la normale,
le contenu de la génération 7 a remplacé celui de la 8 dans les deux navigateurs.

On ne teste pas la page ici (c'est fait dans essai-deux-appareils) mais le CONTRAT du pont,
dont dépend le gel : en mode dégradé, le sondage doit annoncer `degrade: true`, la lecture
aussi, et toute écriture doit être refusée.

Témoin : document sain -> pas de drapeau, écriture acceptée.
Sonde  : document corrompu -> drapeau présent partout, écriture refusée.

Aucune prise commandée : HASS_URL pointe sur un faux service, aucun lot actif.
"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PONT = os.path.join(RACINE, "pont", "pont.py")
JETON = "jeton-verif-d3-0123456789abcdefghij"

ok = 0
ko = 0


def dit(bon, quoi, detail=""):
    global ok, ko
    print("  %s %s%s" % ("OK  " if bon else "KO  ", quoi, (" — " + detail) if detail else ""))
    if bon:
        ok += 1
    else:
        ko += 1


class FauxHA(BaseHTTPRequestHandler):
    def log_message(self, fmt, *a):
        pass

    def _json(self, obj, code=200):
        c = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(c)))
        self.end_headers()
        self.wfile.write(c)

    def do_GET(self):
        if self.path == "/api/states":
            return self._json([])
        self._json({}, 404)

    def do_POST(self):
        self._json([])


def port_libre():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def api(port, chemin, corps=None):
    req = urllib.request.Request(
        "http://127.0.0.1:%d/api/%s" % (port, chemin),
        data=json.dumps(corps).encode() if corps is not None else None,
        headers={"Authorization": "Bearer " + JETON, "Content-Type": "application/json"},
        method="POST" if corps is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except ValueError:
            return e.code, {}


def attendre(fn, limite=25, pas=0.4):
    t0 = time.time()
    while time.time() - t0 < limite:
        if fn():
            return True
        time.sleep(pas)
    return False


DOC = {"recettes": [{"id": "r1", "name": "D3", "archived": False}],
       "lots": [], "appareils": [], "reglages": {}}

rep = tempfile.mkdtemp(prefix="d3-")
pHA, pPont = port_libre(), port_libre()
srv = ThreadingHTTPServer(("127.0.0.1", pHA), FauxHA)
Thread(target=srv.serve_forever, daemon=True).start()

env = dict(os.environ, HASS_URL="http://127.0.0.1:%d" % pHA, HASS_TOKEN="x",
           PONT_PORT=str(pPont), PONT_AUTH="jeton", PONT_JETON=JETON,
           PONT_ETAT=os.path.join(rep, "etat.json"), PONT_DONNEES=rep,
           PONT_SONDES="sensor.sonde_d3", PONT_PRISES="switch.prise_d3")
proc = subprocess.Popen([sys.executable, PONT], env=env,
                        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
try:
    def vivant():
        try:
            return api(pPont, "etat")[0] == 200
        except Exception:
            return False

    if not attendre(vivant):
        proc.kill()
        print("ÉCHEC : le pont ne démarre pas")
        print((proc.communicate(timeout=10)[0] or "")[:1500])
        sys.exit(2)

    print("=== D3 : mode dégradé — la page doit se geler ===")

    # Deux révisions, pour qu'il EXISTE une génération précédente.
    st, j = api(pPont, "donnees", {"base": 0, "donnees": DOC, "op": "d3-1"})
    rev1 = j.get("rev")
    doc2 = json.loads(json.dumps(DOC))
    doc2["recettes"][0]["name"] = "D3 modifiée"
    st, j = api(pPont, "donnees", {"base": rev1, "donnees": doc2, "op": "d3-2"})
    rev2 = j.get("rev")
    dit(rev2 and rev2 > rev1, "deux générations écrites", "rev %s puis %s" % (rev1, rev2))

    # --- témoin : document sain
    st, tete = api(pPont, "donnees/rev")
    dit(tete.get("degrade") is not True, "témoin : document sain -> aucun drapeau `degrade`",
        "rev %s" % tete.get("rev"))
    st_ecr, _ = api(pPont, "donnees", {"base": rev2, "donnees": doc2, "op": "d3-temoin"})
    dit(st_ecr == 200, "témoin : l'écriture est acceptée", "HTTP %d" % st_ecr)

    # --- sonde : on corrompt le document COURANT (celui de la révision en cours, pas le
    # dernier par ordre alphabétique : l'écriture témoin en a créé un de plus).
    st, tete_av = api(pPont, "donnees/rev")
    rev_courante = tete_av.get("rev")
    cands = [n for n in os.listdir(rep)
             if n.startswith("donnees") and n.endswith(".json") and "meta" not in n]
    courant = None
    for n in cands:
        p = os.path.join(rep, n)
        try:
            with open(p, encoding="utf-8") as f:
                if json.load(f).get("rev") == rev_courante:
                    courant = p
                    break
        except Exception:
            continue
    if courant is None and cands:
        courant = max((os.path.join(rep, n) for n in cands), key=os.path.getmtime)
    if not courant:
        fichiers = sorted(os.listdir(rep))
        dit(False, "le fichier du document courant est introuvable", ", ".join(fichiers)[:120])
    else:
        with open(courant, "w", encoding="utf-8") as f:
            f.write("{ ceci n'est pas du JSON")
        time.sleep(0.5)

        st, tete = api(pPont, "donnees/rev")
        dit(tete.get("degrade") is True,
            "sonde : document corrompu -> le SONDAGE annonce `degrade: true`",
            "rev servie %s" % tete.get("rev"))
        dit(tete.get("rev") is not None and tete.get("rev") < rev_courante,
            "la révision servie RECULE (c'est bien la génération précédente)",
            "%s au lieu de %s" % (tete.get("rev"), rev_courante))

        st, lecture = api(pPont, "donnees")
        dit(lecture.get("degrade") is True,
            "sonde : la LECTURE complète porte aussi le drapeau")

        st_ecr, rep_ecr = api(pPont, "donnees",
                              {"base": tete.get("rev"), "donnees": doc2, "op": "d3-sonde"})
        dit(st_ecr == 507,
            "sonde : toute écriture est refusée (507), la cause n'est pas effacée",
            "HTTP %d, motif %s" % (st_ecr, rep_ecr.get("motif")))

    # --- la page lit-elle ce drapeau ? (gel + bandeau)
    page = open(os.path.join(RACINE, "hakko-dashboard.html"), encoding="utf-8", newline="").read()
    dit("tete.degrade === true" in page,
        "la page GÈLE sur `degrade` (ni dépôt, ni adoption)")
    dit("D.degrade" in page,
        "le gel est AFFICHÉ : un bandeau explique que rien n'est partagé")
    i = page.find("if (tete.degrade === true)")
    j2 = page.find("if (sceau && sceau.semence")
    dit(i > 0 and j2 > 0 and i < j2,
        "le gel est testé AVANT toute adoption (comme G1)")
finally:
    proc.kill()
    srv.shutdown()

print()
print("---")
print("Réussies : %d | Échouées : %d | Total : %d" % (ok, ko, ok + ko))
print("VERDICT : SUCCÈS" if ko == 0 else "VERDICT : ÉCHEC — %d assertion(s)" % ko)
sys.exit(0 if ko == 0 else 1)
