"""Vérification indépendante du défaut D1 signalé par la relecture.

Thèse d'Opus : la garde `maj` ne voit pas un lot SUPPRIMÉ. Un appareil périmé qui rejoue son
vieux document rallume donc la prise réelle, sans avertissement — alors qu'un lot ARCHIVÉ
rejoué est bien mis en quarantaine.

Si c'est vrai, c'est exactement l'incident d'origine (« j'ai annulé la recette et pourtant la
ceinture chauffe ») reconstruit sur une résistance, et la garde centrale de la passe est
inopérante dans le cas le plus courant : on supprime une recette.

Témoin + sonde, pour que la comparaison tranche :
  - témoin : le lot est ARCHIVÉ dans le document courant, puis rejoué ACTIF -> quarantaine ?
  - sonde  : le lot est SUPPRIMÉ du document courant, puis rejoué ACTIF -> quarantaine ?

Aucune commande ne part vers un vrai Home Assistant : HASS_URL pointe sur un faux service.
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
JETON = "jeton-verif-d1-0123456789abcdefghij"

SONDE = "sensor.sonde_d1_temperature"
PRISE = "switch.prise_d1"

etats = {PRISE: "off"}
recus = []


class FauxHA(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, obj, code=200):
        c = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(c)))
        self.end_headers()
        self.wfile.write(c)

    def _fiche(self, eid):
        if eid.startswith("sensor."):
            return {"entity_id": eid, "state": "20.0",
                    "attributes": {"unit_of_measurement": "°C", "friendly_name": "Sonde D1"},
                    "last_updated": time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime())}
        return {"entity_id": eid, "state": etats.get(eid, "off"),
                "attributes": {"friendly_name": eid},
                "last_updated": time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime())}

    def do_GET(self):
        if self.path == "/api/states":
            return self._json([self._fiche(SONDE), self._fiche(PRISE)])
        if self.path.startswith("/api/states/"):
            return self._json(self._fiche(self.path[len("/api/states/"):]))
        self._json({}, 404)

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        corps = self.rfile.read(n) if n else b"{}"
        if "/api/services/switch/" in self.path:
            quoi = "on" if self.path.endswith("turn_on") else "off"
            try:
                eid = json.loads(corps).get("entity_id")
                etats[eid] = quoi
                recus.append((eid, quoi, time.time()))
            except Exception:
                pass
            return self._json([])
        self._json({}, 404)


def port_libre():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def api(port, chemin, corps=None, methode=None):
    req = urllib.request.Request(
        "http://127.0.0.1:%d/api/%s" % (port, chemin),
        data=json.dumps(corps).encode() if corps is not None else None,
        headers={"Authorization": "Bearer " + JETON, "Content-Type": "application/json"},
        method=methode or ("POST" if corps is not None else "GET"))
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def document(statut, maj_lot):
    """Un lot avec sa recette figée, une sonde et une prise rattachées."""
    return {
        "recettes": [{"id": "r1", "name": "Test D1", "type": "koji", "duration": 5,
                      "temp": 30, "tol": 0.3, "archived": False}],
        "lots": [{"id": "b1", "name": "Test D1 #1", "status": statut,
                  "recipe": {"id": "r1", "name": "Test D1", "type": "koji",
                             "duration": 5, "temp": 30, "tol": 0.3},
                  "start": int(time.time() * 1000), "maj": maj_lot}],
        "appareils": [
            {"id": "s1", "eid": SONDE, "name": "Sonde D1", "kind": "temp", "batch": "b1",
             "mode": "auto", "slot": 1},
            {"id": "p1", "eid": PRISE, "name": "Prise D1", "kind": "plug", "batch": "b1",
             "mode": "auto", "slot": 2},
        ],
        "reglages": {},
    }


def attendre(fn, limite=30, pas=0.5):
    t0 = time.time()
    while time.time() - t0 < limite:
        v = fn()
        if v:
            return v
        time.sleep(pas)
    return None


def cas(nom, statut_courant, attendu_exclu):
    """Écrit un document, puis rejoue le lot ACTIF avec un `maj` plus VIEUX."""
    global recus
    rep = tempfile.mkdtemp(prefix="d1-")
    pHA, pPont = port_libre(), port_libre()

    srv = ThreadingHTTPServer(("127.0.0.1", pHA), FauxHA)
    Thread(target=srv.serve_forever, daemon=True).start()

    etats[PRISE] = "off"
    recus = []

    env = dict(os.environ,
               HASS_URL="http://127.0.0.1:%d" % pHA, HASS_TOKEN="x",
               PONT_PORT=str(pPont), PONT_AUTH="jeton", PONT_JETON=JETON,
               PONT_ETAT=os.path.join(rep, "etat.json"), PONT_DONNEES=rep,
               PONT_SONDES=SONDE, PONT_PRISES=PRISE)
    proc = subprocess.Popen([sys.executable, PONT], env=env,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    try:
        if not attendre(lambda: api(pPont, "etat")[0] == 200, 25):
            print("  %-10s ÉCHEC : le pont ne démarre pas" % nom)
            return None

        maintenant = int(time.time())
        # 1) le lot vit, ACTIF : le pont le prend au plan.
        #    Le pont RÉÉCRIT `maj` au temps courant : c'est ce maj-là qu'un appareil périmé
        #    aurait en mémoire, et c'est donc lui qu'il faut rejouer (un maj inventé plus
        #    vieux que l'enregistré ne reproduit rien : il serait écrasé à l'écriture).
        st, j = api(pPont, "donnees", {"base": 0, "donnees": document("active", maintenant),
                                       "op": "d1-a"})
        rev1 = j.get("rev")
        _, lu = api(pPont, "donnees")
        maj_vu = ((lu.get("donnees") or {}).get("lots") or [{}])[0].get("maj")
        time.sleep(1.2)                           # pour que le maj suivant soit postérieur

        # 2) l'utilisateur archive OU supprime le lot (révision suivante)
        doc2 = document(statut_courant, maintenant + 10)
        if statut_courant == "supprime":
            doc2["lots"] = []                      # le lot n'existe plus
        st, j = api(pPont, "donnees", {"base": rev1, "donnees": doc2, "op": "d1-b"})
        rev2 = j.get("rev")

        # on laisse le pont couper ce qu'il avait allumé
        time.sleep(1.5)
        etats[PRISE] = "off"
        recus = []

        # 3) un APPAREIL PÉRIMÉ rejoue son vieux document : lot ACTIF, `maj` plus vieux
        try:
            _m = json.load(open(os.path.join(rep, "donnees-meta.json"), encoding="utf-8"))
            print("             [memoire avant rejeu] majs=%s quarantaine=%s"
                  % (_m.get("majs"), _m.get("quarantaine")))
        except Exception as _e:
            print("             [memoire illisible] %s" % _e)
        print("             [maj rejoue] %s" % maj_vu)
        st, j = api(pPont, "donnees", {"base": rev2, "donnees": document("active", maj_vu),
                                       "op": "d1-c"})
        avert = j.get("avertissements") or []
        # La réponse POST ne porte ni `exclus` ni le plan : c'est GET /api/regul qui les dit.
        time.sleep(1.0)
        _, r = api(pPont, "regul")
        plan = [l.get("id") for l in (r.get("lots") or []) if l.get("actif")]
        exclus = r.get("exclus") or (r.get("source") or {}).get("exclus") or []

        # 4) que fait la régulation ? (sonde à 20 °C, consigne 30 °C -> elle allumerait)
        allume = attendre(lambda: etats.get(PRISE) == "on", 30) or False

        exclu = ("b1" in exclus) or ("b1" not in plan)
        verdict = "CONFORME" if exclu == attendu_exclu else "DÉFAUT CONFIRMÉ"
        print("  %-10s exclus=%-8s plan=%-8s allumée=%-5s avert=%d  -> %s"
              % (nom, exclus or "[]", plan or "[]", allume, len(avert), verdict))
        if avert:
            for a in avert[:2]:
                print("             avert : %s" % a)
        return {"exclu": exclu, "allume": bool(allume), "attendu": attendu_exclu,
                "conforme": exclu == attendu_exclu}
    finally:
        proc.kill()
        srv.shutdown()


print("=== D1 : la garde `maj` voit-elle un lot SUPPRIMÉ ? ===")
print("  (un appareil périmé rejoue un lot ACTIF avec un `maj` plus vieux)\n")
temoin = cas("ARCHIVÉ", "done", True)        # doit être mis en quarantaine
sonde = cas("SUPPRIMÉ", "supprime", True)    # doit l'être AUSSI

print()
if temoin and sonde:
    if temoin["conforme"] and not sonde["conforme"]:
        print("VERDICT : D1 CONFIRMÉ — un lot archivé est protégé, un lot supprimé NON.")
        if sonde["allume"]:
            print("          Et la prise a été RALLUMÉE : l'incident d'origine, reconstruit.")
        sys.exit(1)
    if temoin["conforme"] and sonde["conforme"]:
        print("VERDICT : D1 NON reproduit — les deux cas sont protégés.")
        sys.exit(0)
print("VERDICT : résultat ambigu, à relire.")
sys.exit(2)
