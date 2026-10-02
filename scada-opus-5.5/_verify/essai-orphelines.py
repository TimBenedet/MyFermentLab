"""Rejoue l'incident : une recette annulée alors que la prise chauffait.

Le pont est éprouvé sans réseau : Home Assistant et le commandeur sont substitués,
et l'on regarde la TRACE DES ORDRES ÉMIS — pas l'écran.
"""
import sys, json, time
sys.path.insert(0, "pont")
import pont

ETAT = {"switch.o4": "on", "switch.o2": "off"}
ORD = []
HA_MUET = [False]

def faux_appel_ha(chemin, methode="GET", corps=None):
    if HA_MUET[0]:
        raise RuntimeError("Home Assistant injoignable")
    if chemin.startswith("/api/states/"):
        e = chemin.split("/api/states/")[1]
        if e.startswith("sensor."):
            return {"state": "25.7", "last_updated": _iso(0), "attributes": {"unit_of_measurement": "°C"}}
        return {"state": ETAT.get(e, "off"), "last_updated": _iso(0), "attributes": {}}
    return {}

def _iso(age):
    import datetime
    return (datetime.datetime.now(datetime.timezone.utc)
            - datetime.timedelta(seconds=age)).isoformat()

def faux_commander(entite, allume, auto=False):
    ORD.append((entite, allume))
    ETAT[entite] = "on" if allume else "off"
    return {"etat": ETAT[entite], "confirme": True}

pont.appel_ha = faux_appel_ha
pont.commander = faux_commander
pont.sauver_etat = lambda: None

LOT = {"id": "b9", "nom": "Test eau #2", "consigne": 60.0, "sonde": "sensor.sonde1_temperature",
       "prises": ["switch.o4", "switch.o2"], "ecart": 1.3, "fin": None, "actif": True}

def tour(lots, etat_initial=None):
    """Un tour de régulation, comme la boucle le fait toutes les 20 s."""
    ORD.clear()
    pont._decisions.clear()
    pont._derniere_commande.clear()          # sinon le frein d'une minute masque tout
    if etat_initial is not None:
        ETAT.update(etat_initial)
    with pont._verrou_plan:
        pont._plan["lots"] = lots
        pont._plan["sans_mesure_max"] = 900
    pont.boucle_regulation()
    return list(ORD), [d["x"] for d in pont._decisions]

print("=" * 78)
print("1. recette en cours, sous la consigne : la prise chauffe")
ordres, _ = tour([LOT], {"switch.o4": "off"})
print("   ordres :", ordres, "| memoire du pont :", list(pont._allumees_par_pont))

print("\n2. la recette est TOUJOURS en cours : rien ne la coupe")
ordres, j = tour([LOT])
print("   ordres :", ordres or "aucun", "(doit rester allumee)")

print("\n3. L'INCIDENT : recette annulee -> le plan se vide alors que la prise chauffe")
ordres, j = tour([])
print("   ordres :", ordres)
print("   journal :", j)

print("\n4. une prise allumee par quelqu'un d'autre : le pont n'y touche pas")
pont._allumees_par_pont.clear()
ETAT["switch.o2"] = "on"
ordres, j = tour([])
print("   ordres :", ordres or "aucun", "| switch.o2 reste", ETAT["switch.o2"])

print("\n5. recette mise en pause (actif=false) pendant la chauffe")
ordres, _ = tour([LOT], {"switch.o4": "off", "switch.o2": "off"})
pause = dict(LOT, actif=False)
ordres, j = tour([pause])
print("   apres allumage :", ordres or "aucun")
print("   journal :", j)

print("\n6. Home Assistant injoignable pendant le balayage : on ne perd pas l'orpheline")
ordres, _ = tour([LOT], {"switch.o4": "off", "switch.o2": "off"})
HA_MUET[0] = True
ordres, j = tour([])
print("   ordres :", ordres or "aucun", "| memoire conservee :", list(pont._allumees_par_pont))
HA_MUET[0] = False
ordres, j = tour([])
print("   HA revenu -> ordres :", ordres)
