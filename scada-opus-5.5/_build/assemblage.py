#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Assemblage du dashboard Hakko depuis _build/parts/ vers hakko-dashboard.html.

Le parent est propriétaire de ce script et du fichier final.
Usage : python _build/assemblage.py [--verifie]
"""
import sys, os, subprocess

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARTS = os.path.join(RACINE, "_build", "parts")
SORTIE = os.path.join(RACINE, "hakko-dashboard.html")
REFERENCE = os.path.join(RACINE, "_verify", "reference-original.html")

ORDRE_CSS = ["03-style-a.css", "03-style-b.css"]
ORDRE_JS = ["04-script-a.js", "04-script-b.js", "04-script-c.js", "04-script-d.js"]
JOINTURE = "\n\n"  # la ligne vide séparant deux parts successives dans la source


def lire(nom):
    chemin = os.path.join(PARTS, nom)
    with open(chemin, encoding="utf-8") as f:
        contenu = f.read()
    if contenu.endswith("\n"):  # une seule fin de ligne retirée : les lignes vides
        contenu = contenu[:-1]  # finales de la part doivent être conservées
    return contenu.split("\n")


def assemble():
    manquants = [n for n in ["01-head.html", "02-body.html"] + ORDRE_CSS + ORDRE_JS
                 if not os.path.exists(os.path.join(PARTS, n))]
    if manquants:
        print("parts manquantes : " + ", ".join(manquants))
        return None

    lignes = []
    for ligne in lire("01-head.html"):
        if ligne.lstrip().startswith("<style"):
            lignes.append("<style>")
            lignes.append(JOINTURE.join("\n".join(lire(n)) for n in ORDRE_CSS))
            lignes.append("</style>")
        else:
            lignes.append(ligne)
    lignes.extend(lire("02-body.html"))
    lignes.append("<script>")
    lignes.append(JOINTURE.join("\n".join(lire(n)) for n in ORDRE_JS))
    lignes.append("")  # ligne vide finale du script, présente dans la référence
    lignes.append("</script>")
    lignes.append("</body>")
    lignes.append("</html>")
    return "\n".join(lignes) + "\n"


def main():
    texte = assemble()
    if texte is None:
        return 2
    with open(SORTIE, "w", encoding="utf-8", newline="\n") as f:
        f.write(texte)
    print("écrit %s (%d lignes, %d octets)" % (SORTIE, texte.count("\n"), len(texte.encode("utf-8"))))
    if os.path.exists(REFERENCE):
        r = subprocess.run(["diff", REFERENCE, SORTIE], capture_output=True, text=True)
        if r.returncode == 0:
            print("diff référence : IDENTIQUE")
        else:
            d = r.stdout.splitlines()
            print("diff référence : %d lignes d'écart" % len(d))
            print("\n".join(d[:60]))
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
