# -*- coding: utf-8 -*-
"""Deux serveurs statiques sur deux ports = deux origines distinctes.

8811 -> l'original (référence)   ; 8812 -> le build reconstruit.
Sans cela, les deux pages partagent le même localStorage (clé hakko-dashboard-v1)
et le test de persistance / de seed initial est faussé.
allow_reuse_address = False : sur Windows SO_REUSEADDR autorise deux processus à
lier le même port, donc un serveur périmé peut continuer à servir l'ancien fichier.
"""
import http.server, socketserver, threading, os

RACINE = r"C:\Users\Timothée\Documents\IA\Hermes\FermentationLab2"
os.chdir(RACINE)


class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()


class Serveur(socketserver.ThreadingTCPServer):
    allow_reuse_address = False
    daemon_threads = True


def servir(port):
    with Serveur(("127.0.0.1", port), H) as httpd:
        httpd.serve_forever()


for p in (8811, 8812):
    threading.Thread(target=servir, args=(p,), daemon=True).start()
print("serveurs prêts : 8811 (référence) / 8812 (build)", flush=True)
threading.Event().wait()
