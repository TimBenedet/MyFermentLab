"""Éprouve la régulation du pont, sans jamais ouvrir de page.

Usage : python essai-regul.py <phase>
  prep    : santé, refus sans jeton, refus hors liste blanche, dépôt du plan
  attente : attend qu'une prise soit dans l'état voulu (journal du faux HA)
  etat    : affiche le journal du faux HA et les décisions du pont
  regle   : règle la sonde du faux HA (valeur + âge en secondes)
  plan    : dépose un plan (consigne)
"""
import json, sys, time, urllib.request, urllib.error

PONT = "http://127.0.0.1:18080"
FAUX = "http://127.0.0.1:18124"
JETON = "0123456789abcdef0123456789abcdef"

def appel(url, methode="GET", corps=None, jeton=JETON):
    donnees = json.dumps(corps).encode() if corps is not None else None
    r = urllib.request.Request(url, data=donnees, method=methode,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + jeton})
    try:
        with urllib.request.urlopen(r, timeout=10) as rep:
            return rep.status, json.loads(rep.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read().decode() or "{}")
        except Exception: return e.code, {}
    except Exception as e:
        return 0, {"erreur": type(e).__name__}

def journal_faux():
    return appel(FAUX + "/__journal")[1]

def decisions():
    return appel(PONT + "/api/regul")[1]

def plan(consigne, age=0, prises=None):
    return {"sans_mesure_max": 60, "lots": [{"id": "b9", "nom": "Seau 4 L", "consigne": consigne,
             "ecart": 0.2, "sonde": "sensor.sonde1_temperature",
             "prises": prises or ["switch.outlet_4", "switch.outlet_2"], "actif": True}]}

def attendre(entite, vers, limite=200):
    debut = time.time()
    while time.time() - debut < limite:
        j = journal_faux()
        for c in reversed(j):
            if c["entite"] == entite and c["vers"] == vers:
                return c
        time.sleep(5)
    return None

phase = sys.argv[1] if len(sys.argv) > 1 else "prep"

if phase == "prep":
    for _ in range(20):
        if appel(PONT + "/api/sante")[0] == 200: break
        time.sleep(1)
    print("sante du pont            :", appel(PONT + "/api/sante")[0])
    print("regul sans jeton         :", appel(PONT + "/api/regul", jeton="mauvais")[0], "(401 attendu)")
    print("plan hors liste blanche  :", appel(PONT + "/api/regul", "POST",
          plan(30, prises=["switch.pas_dans_la_liste"])))
    print("plan valide              :", appel(PONT + "/api/regul", "POST", plan(30)))
    print("etat /api/etat (maj_age) :", appel(PONT + "/api/etat")[1]["appareils"][2].get("maj_age"),
          "s |", appel(PONT + "/api/etat")[1]["appareils"][2].get("entite"))
    appel(FAUX + "/__regle?entite=sensor.sonde1_temperature&valeur=23.0&age=0")
    print("sonde reglee a 23.0 °C, fraiche. Aucune page n est ouverte.")

elif phase == "regle":
    v, age = sys.argv[2], sys.argv[3]
    print(appel(FAUX + "/__regle?entite=sensor.sonde1_temperature&valeur=" + v + "&age=" + age))

elif phase == "attente":
    entite, vers = sys.argv[2], sys.argv[3]
    c = attendre(entite, vers)
    print(("COMmande observee : " + json.dumps(c)) if c else ("RIEN en %s pendant l attente" % vers))

elif phase == "etat":
    print("journal du faux Home Assistant :", json.dumps(journal_faux()))
    d = decisions()
    print("regule :", d.get("regule"), "| sans_mesure_max :", d.get("sans_mesure_max"))
    for x in (d.get("decisions") or [])[-6:]:
        print("   decision", x["t"], x["nom"], "|", x["x"])
