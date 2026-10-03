"""Une prise non liée à une recette doit être éteinte — même allumée en dehors du pont.

Le pont est éprouvé sans réseau (Home Assistant et commandeur substitués) et l'on
regarde la trace des ordres réellement émis.
"""
import sys, datetime
sys.path.insert(0, "pont"); import pont

ETAT = {}
ORD = []
HA_MUET = [False]
CFG_PRISES = ["switch.o4", "switch.o5", "switch.o2"]

def iso(age=0):
    return (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=age)).isoformat()

def faux_ha(chemin, methode="GET", corps=None):
    if HA_MUET[0]:
        raise RuntimeError("Home Assistant injoignable")
    if chemin.startswith("/api/states/"):
        e = chemin.split("/api/states/")[1]
        if e.startswith("sensor."):
            return {"state": "25.7", "last_updated": iso(0), "attributes": {"unit_of_measurement": "°C"}}
        return {"state": ETAT.get(e, "off"), "last_updated": iso(0), "attributes": {}}
    return {}

def faux_commander(entite, allume, auto=False):
    ORD.append((entite, bool(allume)))
    ETAT[entite] = "on" if allume else "off"
    return {"etat": ETAT[entite], "confirme": True}

pont.appel_ha = faux_ha
pont.commander = faux_commander
pont.sauver_etat = lambda: None
pont.CFG.prises = CFG_PRISES

LOT = {"id": "b9", "nom": "Test eau", "consigne": 60.0, "sonde": "sensor.sonde1_temperature",
       "prises": ["switch.o4"], "ecart": 1.3, "fin": None, "actif": True}

def tour(lots, etats=None, memo=None):
    ORD.clear(); pont._decisions.clear(); pont._derniere_commande.clear()
    pont._allumees_par_pont.clear()
    if memo: pont._allumees_par_pont.update(memo)
    if etats: ETAT.update(etats)
    with pont._verrou_plan:
        pont._plan["lots"] = lots
        pont._plan["sans_mesure_max"] = 900
    pont.boucle_regulation()
    return list(ORD), [d["x"] for d in pont._decisions]

def montre(titre, ordres, journal, etats):
    print("\n%s" % titre)
    print("   ordres  :", ordres or "aucun")
    if journal: print("   journal :", journal[0])
    print("   etats   :", {k[-2:]: v for k, v in etats.items() if k in CFG_PRISES})

print("=" * 78)
# 1. prise réclamée par une recette en cours : on n'y touche pas
etats = {"switch.o4": "on", "switch.o5": "off", "switch.o2": "off"}
o, j = tour([LOT], dict(etats))
montre("1. o4 réclamée par la recette en cours, allumée -> intacte", o, j, etats)

# 2. o5 allumée EN DEHORS du pont, aucune recette ne la réclame
etats = {"switch.o4": "on", "switch.o5": "on", "switch.o2": "off"}
o, j = tour([LOT], dict(etats))
montre("2. o5 allumée hors du pont, non réclamée -> coupée", o, j, etats)

# 3. recette annulée : la prise que le pont avait allumée est coupée
etats = {"switch.o4": "on", "switch.o5": "off", "switch.o2": "off"}
memo = {"switch.o4": {"lot": "b9", "nom": "Test eau", "t": 0}}
o, j = tour([], dict(etats), memo)
montre("3. recette annulée pendant la chauffe -> coupée", o, j, etats)

# 4. recette mise en pause : idem
o, j = tour([dict(LOT, actif=False)], {"switch.o4": "on", "switch.o5": "off", "switch.o2": "off"},
            {"switch.o4": {"lot": "b9", "nom": "Test eau", "t": 0}})
montre("4. recette mise en pause -> coupée", o, j, etats)

# 5. aucune recette du tout : tout ce qui est allumé s'éteint
etats = {"switch.o4": "on", "switch.o5": "on", "switch.o2": "on"}
o, j = tour([], dict(etats))
montre("5. aucune recette, trois prises allumées -> les trois coupées", o, j, etats)

# 6. Home Assistant injoignable : on ne coupe pas à l'aveugle, on retente
etats = {"switch.o4": "on", "switch.o5": "on", "switch.o2": "off"}
HA_MUET[0] = True
o, j = tour([], dict(etats))
print("\n6. Home Assistant injoignable -> aucun ordre à l'aveugle")
print("   ordres  :", o or "aucun")
HA_MUET[0] = False
o, j = tour([], dict(etats))
print("   HA revenu -> ordres :", o)
