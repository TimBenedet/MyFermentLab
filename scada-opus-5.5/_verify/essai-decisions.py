"""Éprouve la logique de décision du pont, sans réseau ni attente.

On substitue Home Assistant (appel_ha) et le commandeur (commander) : ce qui est testé,
c'est la décision — quand chauffer, quand couper, et sur quelle base.
"""
import importlib.util, json, sys, time, os

os.environ.update({
    "HASS_URL": "http://127.0.0.1:1", "HASS_TOKEN": "x",
    "PONT_JETON": "0123456789abcdef0123456789abcdef",
    "PONT_PRISES": "switch.o4,switch.o2", "PONT_SONDES": "sensor.s1,sensor.hum",
    "PONT_CHAUFFE_MAX": "90", "PONT_SANS_MESURE_MAX": "15",
})
spec = importlib.util.spec_from_file_location("pont", sys.argv[1])
pont = importlib.util.module_from_spec(spec); spec.loader.exec_module(pont)

ETAT = {}                 # entite -> (state, age_en_secondes, unite)
ORDRES = []
def faux_appel_ha(chemin, methode="GET", corps=None):
    e = chemin.split("/api/states/")[-1]
    if e in ETAT:
        st, age, unite = ETAT[e]
        return {"entity_id": e, "state": st,
                "last_updated": time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime(time.time() - age)),
                "attributes": {"friendly_name": e, "unit_of_measurement": unite}}
    return {"entity_id": e, "state": "unknown", "attributes": {}}
pont.appel_ha = faux_appel_ha

def faux_commander(entite, allume, auto=False):
    ORDRES.append((entite, "on" if allume else "off"))
    ETAT[entite] = ("on" if allume else "off", 0, None)
    return {"ok": True, "entite": entite, "etat": "on" if allume else "off"}

def cas(nom, sonde=("23.0", 5, "°C"), prise="on", fin=None, actif=True, jours=None):
    del ORDRES[:]
    ETAT.clear()
    ETAT["sensor.s1"] = sonde
    ETAT["switch.o4"] = (prise, 0, None)
    pont.appel_ha = faux_appel_ha
    pont.commander = faux_commander
    if prise == "on":
        ETAT["switch.o4"] = ("on", 0, None)
    lot = {"id": "b9", "nom": "Seau", "consigne": 30.0, "ecart": 0.2, "sonde": "sensor.s1",
           "prises": ["switch.o4"], "fin": fin, "actif": actif}
    lot.pop("_figee_dite", None)
    if jours is not None:
        lot["fin"] = time.time() + jours
    pont._decisions.clear()
    # Le frein d'une commande par minute et les marqueurs « déjà dit » sont remis à zéro
    # entre deux cas : sinon seul le premier cas d'une même prise peut commander, et le
    # banc d'essai mesure le frein au lieu de la décision.
    pont._derniere_commande.clear()
    for p_ in pont._plan["lots"]:
        p_.pop("_figee_dite", None)
    pont.tour_lot(lot, 900)
    # on relit les ordres réellement envoyés
    etat = ETAT.get("switch.o4", ("?",))[0]
    decide = [d["x"] for d in pont._decisions]
    print("%-52s -> %-28s %s" % (nom, etat, (decide[0][-58:] if decide else "")))

print("=== la décision, cas par cas (consigne 30 °C, écart 0,2) ===")
cas("mesure fraîche 23,0 °C, prise éteinte", sonde=("23.0", 5, "°C"), prise="off")
cas("mesure fraîche 30,5 °C, prise allumée", sonde=("30.5", 5, "°C"), prise="on")
cas("mesure fraîche 29,9 °C (dans la bande)", sonde=("29.9", 5, "°C"), prise="on")
cas("mesure vieille de 20 min, prise allumée", sonde=("23.0", 1200, "°C"), prise="on")
cas("mesure vieille de 2 h, prise allumée", sonde=("23.0", 7200, "°C"), prise="on")
cas("sonde indisponible depuis 3 s, prise allumée", sonde=("unavailable", 3, "°C"), prise="on")
cas("sonde indisponible depuis 20 min, prise allumée", sonde=("unavailable", 1200, "°C"), prise="on")
cas("sonde d'humidité (%), prise allumée", sonde=("54.4", 5, "%"), prise="on")
print("\n=== la fin de lot, en secondes ===")
cas("fin de lot dans 1 h (futur) : on chauffe", sonde=("23.0", 5, "°C"), prise="off", fin=time.time() + 3600)
cas("fin de lot dépassée : on coupe", sonde=("23.0", 5, "°C"), prise="on", fin=time.time() - 60)
print("\n=== ce qui est accepté ou refusé à la validation ===")
for nom, brut in [
    ("consigne 30, fin en secondes (page corrigée)", {"id": "b9", "consigne": 30, "sonde": "sensor.s1", "prises": ["switch.o4"], "actif": True, "fin": time.time() + 86400}),
    ("fin en MILLISECONDES (l'ancien bug)", {"id": "b9", "consigne": 30, "sonde": "sensor.s1", "prises": ["switch.o4"], "actif": True, "fin": (time.time() + 86400) * 1000}),
    ("consigne 300 °C", {"id": "b9", "consigne": 300, "sonde": "sensor.s1", "prises": ["switch.o4"], "actif": True}),
    ("actif absent", {"id": "b9", "consigne": 30, "sonde": "sensor.s1", "prises": ["switch.o4"]}),
    ("prise hors liste blanche", {"id": "b9", "consigne": 30, "sonde": "sensor.s1", "prises": ["switch.autre"], "actif": True}),
]:
    lot, motif = pont.valider_lot(brut, 0)
    print("  %-44s %s" % (nom, "ACCEPTE actif=%s" % lot["actif"] if lot else "REFUSE : " + motif))
