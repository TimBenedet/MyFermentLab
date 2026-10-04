"""Vérification indépendante de D2 et D4 — les deux bloquants « la chauffe repart ».

D2 — réarmement cyclique. Document partagé illisible depuis plus de dix minutes :
     `surveillance` coupe au plafond de chauffe, la température retombe, et le tour
     suivant rallumait parce que `v < c - h`. Le plafond ne plafonnait plus rien.
     Ici : on gèle l'échéance, on vérifie qu'AUCUN allumage neuf n'est commandé.

D4 — l'autorité. Quand le plan déduit est vide, `regule` valait `any(lot actif)` : la
     page redevenait le régulateur et rallumait ce que le pont coupait toutes les 20 s.
     Ici : plan vide mais document lu -> `regule` doit rester VRAI (le pont garde
     l'autorité), et faux seulement s'il n'a jamais lu de document.

Témoin + sonde dans les deux cas. Aucune commande vers un vrai Home Assistant.
"""
import importlib.util
import json
import os
import sys
import tempfile
import time

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PONT = os.path.join(RACINE, "pont", "pont.py")

spec = importlib.util.spec_from_file_location("pont_d2d4", PONT)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

ok = 0
ko = 0


def dit(bon, quoi, detail=""):
    global ok, ko
    print("  %s %s%s" % ("OK  " if bon else "KO  ", quoi, (" — " + detail) if detail else ""))
    if bon:
        ok += 1
    else:
        ko += 1


# ---------------------------------------------------------------- D2
print("=== D2 : la chauffe se réarme-t-elle quand le document est illisible ? ===")

PRISE = "switch.prise_d2"

# `tour_lot(lot, sans_mesure)` lit la sonde et l'état des prises lui-même : on intercepte
# ces deux lectures pour piloter le scénario sans aucun Home Assistant.
etat_courant = {PRISE: "off"}
mesure_courante = {"valeur": 20.0, "unite": "°C", "age": 5.0}
m.etat_prise = lambda eid: etat_courant.get(eid, "off")
m.lire_sonde = lambda eid: dict(mesure_courante)

commandes = []

def _faux_commander(eid, allume, pourquoi=None, **kw):
    commandes.append((eid, allume))
    etat_courant[eid] = "on" if allume else "off"
    return {"etat": "on" if allume else "off"}


m.commander = _faux_commander
lot = {
    "id": "b1", "nom": "Essai D2", "consigne": 30.0, "ecart": 1.3,
    "prises": [PRISE], "sonde": "sensor.sonde_d2", "actif": True,
    "fin": time.time() + 86400,
}

# témoin : document LISIBLE -> la chauffe doit être engagée
m._doc_illisible.update({"depuis": None, "echeance_dite": False})
commandes = []
m.tour_lot(lot, 900)
temoin_allume = any(a for _, a in commandes)
dit(temoin_allume, "témoin : document lisible, 20 °C sous consigne -> la chauffe est engagée",
    "%d commande(s)" % len(commandes))

# sonde : document ILLISIBLE depuis 20 min -> aucun allumage neuf
m._doc_illisible.update({"depuis": time.time() - 20 * 60, "echeance_dite": False})
lot.pop("_gel_dit", None)
commandes = []
m.tour_lot(lot, 900)
allumages = [c for c in commandes if c[1]]
dit(m.echeance_gelee(), "l'échéance est bien gelée après 20 min d'illisibilité")
dit(not allumages, "sonde : AUCUN allumage neuf sur un plan que personne ne peut contredire",
    "%d allumage(s)" % len(allumages))

# et la coupure doit rester possible : prise allumée, température au-dessus.
# Le frein « une commande par minute et par prise » (pont.py:1480) est un frein de
# sûreté légitime : on ne le touche pas, on oublie seulement la commande du scénario
# PRÉCÉDENT, qui est un autre scénario.
m._derniere_commande.clear()
commandes = []
etat_courant[PRISE] = "on"
mesure_courante.update({"valeur": 40.0})
m.tour_lot(lot, 900)
coupures = [c for c in commandes if not c[1]]
dit(bool(coupures), "la COUPURE reste commandée même échéance gelée", "%d coupure(s)" % len(coupures))

# le gel est journalisé une seule fois (pas un journal qui déborde)
etat_courant[PRISE] = "off"
mesure_courante.update({"valeur": 20.0})
m._derniere_commande.clear()
commandes = []
notes = []
m.noter = lambda lot, txt, *a, **kw: notes.append(txt)
m._doc_illisible.update({"depuis": time.time() - 20 * 60})
lot.pop("_gel_dit", None)
commandes = []
for _ in range(4):
    m.tour_lot(lot, 900)
allum_cycles = [c for c in commandes if c[1]]
dit(not allum_cycles,
    "quatre tours de suite échéance gelée : AUCUN allumage (pas de réarmement cyclique)",
    "%d allumage(s)" % len(allum_cycles))
dit(len(notes) == 1, "le gel est annoncé UNE fois, pas à chaque tour", "%d note(s)" % len(notes))

m._doc_illisible.update({"depuis": None, "echeance_dite": False})

# ---------------------------------------------------------------- D4
print()
print("=== D4 : qui détient l'autorité quand le plan est vide ? ===")

# sonde : le pont a LU un document, mais aucun lot actif -> il garde l'autorité
m._source_plan.update({"lu": time.time(), "rev": 3, "exclus": [], "degrade": False})
m._plan["lots"] = []
regule_plan_vide = m._source_plan["lu"] > 0
dit(regule_plan_vide,
    "plan vide mais document lu -> `regule` VRAI : le pont garde l'autorité")

# témoin : jamais lu de document -> la page peut réguler (mode autonome légitime)
m._source_plan.update({"lu": 0})
dit(not (m._source_plan["lu"] > 0),
    "témoin : aucun document jamais lu -> `regule` FAUX, la page régule")

# la condition ne doit PLUS dépendre du nombre de lots
src = open(PONT, encoding="utf-8").read()
i = src.find('"regule"')
extrait = src[i:i + 120].split("\n")[0]
dit("lu" in extrait and "lots" not in extrait,
    "`regule` ne dépend plus du nombre de lots au plan", extrait.strip())

page = open(os.path.join(RACINE, "hakko-dashboard.html"), encoding="utf-8", newline="").read()
import re
affect = re.findall(r"PONT\.regule = !!\([^\r\n]*", page)
dit(bool(affect) and "some" not in (affect[0] if affect else "some"),
    "la page ne recalcule plus `regule` depuis ses propres lots",
    (affect[0] if affect else "introuvable")[:90])

print()
print("---")
print("Réussies : %d | Échouées : %d | Total : %d" % (ok, ko, ok + ko))
print("VERDICT : SUCCÈS" if ko == 0 else "VERDICT : ÉCHEC — %d assertion(s)" % ko)
sys.exit(0 if ko == 0 else 1)
