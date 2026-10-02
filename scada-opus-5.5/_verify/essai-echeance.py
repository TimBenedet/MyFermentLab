"""Une échéance dépassée ne doit annoncer que les coupures réelles."""
import sys, time, datetime
sys.path.insert(0, "pont"); import pont
ETAT = {"switch.o4": "off", "switch.o2": "on"}
ORD = []
pont.appel_ha = lambda c, m="GET", corps=None: (
    {"state": ETAT[c.split("/api/states/")[1]], "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat(), "attributes": {}}
    if c.startswith("/api/states/") else {})
pont.commander = lambda e, a, auto=False: (ORD.append((e, a)), ETAT.__setitem__(e, "on" if a else "off"),
                                          {"etat": ETAT[e], "confirme": True})[-1]
pont.CFG.chauffe_max = 90
class Stop(Exception): pass
def un_seul_tour(_):
    raise Stop
pont.time.sleep = un_seul_tour
for entite in ("switch.o4", "switch.o2"):
    ORD.clear(); pont._echeances.clear()
    pont._echeances[entite] = time.time() - 10        # échéance dépassée
    try:
        pont.surveillance()
    except Stop:
        pass
    print("  %s (initialement %s) -> ordres : %s" % (entite, "off" if entite == "switch.o4" else "on", ORD or "aucun"))
