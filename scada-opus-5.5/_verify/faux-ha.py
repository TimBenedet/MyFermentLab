"""Faux Home Assistant : éprouve la surveillance du pont sur un relais imaginaire.

Aucune prise réelle n'est concernée : ce serveur ne fait que retenir l'état d'une
entité fictive, et journalise chaque commande reçue.
"""
import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ETAT = {"switch.faux": "off"}
VERROU = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def json_reponse(self, objet, code=200):
        corps = json.dumps(objet).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def do_GET(self):
        if self.path == "/api/":
            return self.json_reponse({})
        if self.path == "/api/states":
            with VERROU:
                etats = [
                    {"entity_id": e, "state": s,
                     "attributes": {"friendly_name": e, "unit_of_measurement": None}}
                    for e, s in sorted(ETAT.items())
                ]
            return self.json_reponse(etats)
        if self.path.startswith("/api/states/"):
            entite = self.path[len("/api/states/"):]
            with VERROU:
                etat = ETAT.get(entite, "unknown")
            return self.json_reponse({"entity_id": entite, "state": etat, "attributes": {}})
        self.json_reponse({"message": "chemin inconnu"}, 404)

    def do_POST(self):
        try:
            taille = int(self.headers.get("Content-Length") or 0)
            corps = json.loads(self.rfile.read(taille) or b"{}")
        except ValueError:
            return self.json_reponse({"message": "corps invalide"}, 400)
        entite = corps.get("entity_id") if isinstance(corps, dict) else None
        if self.path.endswith("/turn_on"):
            etat = "on"
        elif self.path.endswith("/turn_off"):
            etat = "off"
        else:
            return self.json_reponse({"message": "service inconnu"}, 404)
        with VERROU:
            ETAT[entite] = etat
        print("  faux Home Assistant : commande %s -> %s" % (entite, etat), flush=True)
        self.json_reponse([])


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 18123
    print("faux Home Assistant sur 127.0.0.1:%d" % port, flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
