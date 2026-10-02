"""Faux Home Assistant pour éprouver la REGULATION du pont (jamais une prise réelle).

Expose deux prises et une sonde dont on pilote la valeur et l'horodatage, plus un
journal des commandes reçues — c'est ce journal qui sert de preuve.
"""
import json, sys, threading, time, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ETAT = {"switch.outlet_4": "off", "switch.outlet_2": "off", "sensor.sonde1_temperature": "23.0"}
MAJ = {"sensor.sonde1_temperature": time.time()}
JOURNAL = []
VERROU = threading.Lock()

def iso(t):
    return datetime.datetime.fromtimestamp(t, datetime.timezone.utc).isoformat().replace("+00:00", "Z")

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def rep(self, obj, code=200):
        c = json.dumps(obj).encode(); self.send_response(code)
        self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(c)))
        self.end_headers(); self.wfile.write(c)

    def etat_entite(self, e):
        with VERROU:
            s = ETAT.get(e, "unknown"); maj = MAJ.get(e, time.time())
        return {"entity_id": e, "state": s, "last_updated": iso(maj),
                "attributes": {"friendly_name": e, "unit_of_measurement": "°C" if e.startswith("sensor") else None}}

    def do_GET(self):
        if self.path.startswith("/__journal"):
            with VERROU: return self.rep(list(JOURNAL))
        if self.path == "/api/":
            return self.rep({})
        if self.path == "/api/states":
            with VERROU: noms = list(ETAT)
            return self.rep([self.etat_entite(e) for e in noms])
        if self.path.startswith("/api/states/"):
            return self.rep(self.etat_entite(self.path[len("/api/states/"):]))
        if self.path.startswith("/__regle"):
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            e = (q.get("entite") or [""])[0]; age = float((q.get("age") or [0])[0])
            with VERROU:
                if "valeur" in q: ETAT[e] = q["valeur"][0]; MAJ[e] = time.time() - age
                elif age: MAJ[e] = time.time() - age
            return self.rep({"ok": True, "etat": ETAT.get(e), "maj": iso(MAJ.get(e, 0))})
        self.rep({"message": "inconnu"}, 404)

    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length") or 0); corps = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return self.rep({"message": "corps invalide"}, 400)
        e = corps.get("entity_id") if isinstance(corps, dict) else None
        if self.path.endswith("/turn_on"): etat = "on"
        elif self.path.endswith("/turn_off"): etat = "off"
        else: return self.rep({"message": "service inconnu"}, 404)
        with VERROU:
            ETAT[e] = etat; JOURNAL.append({"t": time.strftime("%H:%M:%S"), "entite": e, "vers": etat})
        print("  FAUX-HA commande %s -> %s" % (e, etat), flush=True)
        self.rep([])

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 18124
    print("faux HA (régulation) sur 127.0.0.1:%d" % port, flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
