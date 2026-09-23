#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Applique la spécification _verify/spec-mobile.md au fichier hakko-dashboard.html.

Usage :
    python outils/applique-mobile.py [chemin-du-fichier.html]

Insertions — blocs de la spécification recopiés caractère pour caractère, aucune règle
inventée, aucun reformatage :

    1. script de tête (§2.1) : entre la ligne 9 (`<link … fonts>`) et la ligne 10 (`<style>`) ;
    2. blocs A, B, C (§3, §4, §5), dans cet ordre : entre la ligne 492 et `</style>` ;
    3. bouton #vueBtn (§2.2) : avant le bouton de thème ;
    4. icône « tel » (§2.3) : dans l'objet Object.assign(IC, {…}) ;
    5. action « vue » (§2.4) : après la ligne `theme` du gestionnaire de clic ;
    6. appel de démarrage (§2.5) : après `applyTheme();`.

Garanties :
    - un ancrage introuvable, ou trouvé un nombre de fois différent de 1, fait échouer le
      script AVANT toute écriture : rien n'est inséré au hasard ;
    - les fins de ligne CRLF et l'encodage UTF-8 sans BOM sont conservés ;
    - le script est idempotent : si les six insertions sont déjà présentes, il affiche
      « aucun changement » et laisse le fichier intact ;
    - l'écriture passe par un fichier temporaire puis os.replace : aucun état partiel.
"""
import hashlib
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

FICHIER_DEFAUT = "C:/Users/Timothée/Documents/IA/Hermes/MyFermentLab/scada-opus-5.5/hakko-dashboard.html"
CRLF = "\r\n"


class Refus(Exception):
    """Ancrage absent ou ambigu, ou état incohérent : on n'écrit rien."""


# ---------------------------------------------------------------------------
# Blocs à insérer, recopiés de _verify/spec-mobile.md
# ---------------------------------------------------------------------------

SCRIPT_TETE = '''<script>
/* ---------- Vue téléphone ----------
   « vue-tel » : présentation téléphone forcée par le bouton (cadre de 430 px).
   « tactile » : cibles et champs agrandis, sous 900 px ou en vue forcée.
   Posées ici, avant la feuille de style, pour que la première image soit la bonne. */
const VUE_CLE = 'hakko-vue';
const vueEtroite = matchMedia('(max-width: 900px)');
let vueForcee = false; try { vueForcee = localStorage.getItem(VUE_CLE) === 'tel'; } catch(e) {}
function appliquerVue(){
  const h = document.documentElement;
  h.classList.toggle('vue-tel', vueForcee);
  h.classList.toggle('tactile', vueForcee || vueEtroite.matches);
  const b = document.getElementById('vueBtn');
  if (b) b.setAttribute('aria-pressed', vueForcee ? 'true' : 'false');
}
function basculerVue(){
  vueForcee = !vueForcee;
  try { if (vueForcee) localStorage.setItem(VUE_CLE, 'tel'); else localStorage.removeItem(VUE_CLE); } catch(e) {}
  appliquerVue();
}
vueEtroite.addEventListener('change', appliquerVue);
appliquerVue();
</script>'''

BLOC_A = '''/* ===== Vue téléphone forcée (bouton) : cadre de 430 px et recopie des @media =====
   Chaque règle porte la valeur NETTE qu'obtient une fenêtre de 430 px après cascade.
   Rien ici ne s'applique sans la classe vue-tel. */
html.vue-tel{--cadre-tel:430px}
html.vue-tel body{max-width:var(--cadre-tel);margin:0 auto;box-shadow:0 0 0 1px var(--line)}
html.vue-tel dialog{width:min(calc(var(--cadre-tel) - 32px),calc(100vw - 32px))}

/* recopie de @media (max-width:900px), l. 89-100 : coquille */
html.vue-tel .app{grid-template-columns:1fr}
html.vue-tel .side{display:none}
html.vue-tel .topbar{padding:0 16px}
html.vue-tel .m-brand{display:grid}
html.vue-tel .sync-txt{display:none}
html.vue-tel .content{padding:20px 16px calc(84px + env(safe-area-inset-bottom,0px))}
html.vue-tel .tabbar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:20;max-width:var(--cadre-tel);margin:0 auto;background:var(--surface);border-top:1px solid var(--line);padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px))}
html.vue-tel .tabbar a{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 0;color:var(--muted);font-size:11.5px;font-weight:500}
html.vue-tel .tabbar a svg{width:20px;height:20px}
html.vue-tel .tabbar a[aria-current="page"]{color:var(--accent)}

/* recopie de @media (max-width:900px), l. 209-218 : tableaux en fiches */
html.vue-tel table.data.stack thead{display:none}
html.vue-tel table.data.stack,html.vue-tel table.data.stack tbody,html.vue-tel table.data.stack tr{display:block}
html.vue-tel table.data.stack tr{padding:12px 16px;border-bottom:1px solid var(--line)}
html.vue-tel table.data.stack tr:last-child{border-bottom:0}
html.vue-tel table.data.stack td{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:4px 0;border:0;text-align:right}
html.vue-tel table.data.stack td[data-l]::before{content:attr(data-l);color:var(--muted);font-size:12.5px;text-align:left}
html.vue-tel table.data.stack td.first{justify-content:flex-start;text-align:left;padding-bottom:8px}
html.vue-tel table.data.stack .ctl{justify-content:flex-end}

/* recopie de @media (max-width:1180px), l. 184 et l. 490 */
html.vue-tel .ov{grid-template-columns:1fr}
html.vue-tel .home .feed-card{max-height:360px}
html.vue-tel .home .lots.scroll{overflow:visible}

/* recopie de @media (max-width:1100px), l. 306, 393-404, 421, 434 */
html.vue-tel .rf{grid-template-columns:1fr}
html.vue-tel .sticky{position:static}
html.vue-tel .dp-grid{grid-template-columns:1fr;grid-template-rows:none}
html.vue-tel .dp-chart,html.vue-tel .dp-journal,html.vue-tel .dp-devs,html.vue-tel .dp-side{grid-column:auto;grid-row:auto}
html.vue-tel .dp-chart{height:380px}
html.vue-tel .dp-journal{height:420px}
html.vue-tel .dp-side>.dp-params{flex:none}
html.vue-tel .dp-chart-body.with-side{flex-direction:column}
html.vue-tel .dp-chart.dp-chart:has(.with-side){height:auto}
html.vue-tel .dp-chart-body.with-side .dp-plot{height:260px;flex:none}
html.vue-tel .grav-side{width:auto;border-left:0;padding-left:0}
html.vue-tel .grav-list{max-height:240px}
html.vue-tel .dp-grid.arch .arch-2{height:320px}
html.vue-tel .dp-grid.arch .dp-devs{height:360px}

/* recopie de ≤ 1250 (3 col.), ≤ 760 (2 col.), ≤ 440 (1 col.) : valeur nette à 430 px */
html.vue-tel .outlets{grid-template-columns:1fr}

/* recopie de @media (max-width:640px) : seulement ce qui est vivant à 430 px */
html.vue-tel .fgrid{grid-template-columns:1fr}
html.vue-tel .types{grid-template-columns:1fr 1fr}
html.vue-tel .rrow:not(.step),html.vue-tel .rows-h{grid-template-columns:minmax(0,1fr) 96px 34px}
html.vue-tel .journal li.jl time{grid-column:1/-1}

/* neutralisation de @media (min-width:1101px) and (min-height:640px), l. 388-392 et 487-489 :
   à 1440 × 900 ce verrou fixerait .dp à la hauteur de la fenêtre */
html.vue-tel .dp{height:auto;min-height:0;display:block}

/* bouton enfoncé */
html.vue-tel #vueBtn{background:var(--accent-soft);border-color:var(--accent);color:var(--accent)}'''

BLOC_B = '''/* ===== Tactile : téléphone (≤ 900 px, classe posée par le script) ou vue forcée ===== */
html:is(.tactile,.vue-tel){--cible:44px;--police-champ:16px}

html:is(.tactile,.vue-tel) .home-grid{grid-template-columns:minmax(0,1fr)}
html:is(.tactile,.vue-tel) .home .lots{grid-template-columns:repeat(auto-fill,minmax(min(250px,100%),1fr))}

html:is(.tactile,.vue-tel) .tabs{gap:0;padding:0 4px;overflow-x:auto;overflow-y:hidden;border-bottom:0;box-shadow:inset 0 -1px 0 var(--line);scrollbar-width:none}
html:is(.tactile,.vue-tel) .tabs::-webkit-scrollbar{display:none}
html:is(.tactile,.vue-tel) .tabs>button{flex:1 0 auto;height:auto;min-height:var(--cible);align-self:stretch;padding:0 8px;margin-bottom:0;white-space:nowrap}
html:is(.tactile,.vue-tel) .tabs .cnt{margin-left:4px}

html:is(.tactile,.vue-tel) .switch{width:56px;height:32px}
html:is(.tactile,.vue-tel) .switch::after{width:28px;height:28px}
html:is(.tactile,.vue-tel) .switch[aria-checked="true"]::after{transform:translateX(24px)}
html:is(.tactile,.vue-tel) .switch::before{content:"";position:absolute;left:0;right:0;top:calc((32px - var(--cible)) / 2);bottom:calc((32px - var(--cible)) / 2)}
html:is(.tactile,.vue-tel) .ctl{gap:16px}

html:is(.tactile,.vue-tel) .icon-btn{position:relative}
html:is(.tactile,.vue-tel) .icon-btn::before{content:"";position:absolute;inset:calc((34px - var(--cible)) / 2)}
html:is(.tactile,.vue-tel) .m-brand{position:relative}
html:is(.tactile,.vue-tel) .m-brand::before{content:"";position:absolute;inset:calc((28px - var(--cible)) / 2)}
html:is(.tactile,.vue-tel) .btn:not(.sm){height:var(--cible)}
html:is(.tactile,.vue-tel) .btn.sm{position:relative}
html:is(.tactile,.vue-tel) .btn.sm::before{content:"";position:absolute;left:0;right:0;top:calc((30px - var(--cible)) / 2);bottom:calc((30px - var(--cible)) / 2)}
html:is(.tactile,.vue-tel) .seg button{height:var(--cible)}
html:is(.tactile,.vue-tel) .stepper button{width:var(--cible);height:var(--cible)}
html:is(.tactile,.vue-tel) .crumbs a{display:inline-flex;align-items:center;min-height:var(--cible)}

html:is(.tactile,.vue-tel) :is(input[type=text],input[type=number],input[type=search],input[type=datetime-local],select){height:var(--cible)}
html:is(.tactile,.vue-tel) :is(input[type=text],input[type=number],input[type=search],input[type=datetime-local],select,textarea){font-size:var(--police-champ)}
html:is(.tactile,.vue-tel) .stepper input[type=number]{font-size:18px}

html:is(.tactile,.vue-tel) #journal-list li.jl{grid-template-columns:auto minmax(0,1fr);row-gap:4px}
html:is(.tactile,.vue-tel) #journal-list li.jl time{grid-column:1/-1}'''

BLOC_C = '''@media (max-width:900px){
  /* la marge basse de sécurité est déjà dans .content (l. 95) : ne pas la compter deux fois */
  :root{padding-bottom:0}
  /* paysage : l'îlot dynamique et les bords arrondis mordent à gauche et à droite */
  .topbar{padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
  .content{padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
  .tabbar{padding-left:max(8px,env(safe-area-inset-left,0px));padding-right:max(8px,env(safe-area-inset-right,0px))}
  /* sans effet ici ; reste visible s'il est enfoncé, pour pouvoir sortir de la vue forcée */
  html:not(.vue-tel) #vueBtn{display:none}
}'''

BLOC_ABC = '''/* ===== Vue téléphone forcée (bouton) : cadre de 430 px et recopie des @media =====
   Chaque règle porte la valeur NETTE qu'obtient une fenêtre de 430 px après cascade.
   Rien ici ne s'applique sans la classe vue-tel. */
html.vue-tel{--cadre-tel:430px}
html.vue-tel body{max-width:var(--cadre-tel);margin:0 auto;box-shadow:0 0 0 1px var(--line)}
html.vue-tel dialog{width:min(calc(var(--cadre-tel) - 32px),calc(100vw - 32px))}

/* recopie de @media (max-width:900px), l. 89-100 : coquille */
html.vue-tel .app{grid-template-columns:1fr}
html.vue-tel .side{display:none}
html.vue-tel .topbar{padding:0 16px}
html.vue-tel .m-brand{display:grid}
html.vue-tel .sync-txt{display:none}
html.vue-tel .content{padding:20px 16px calc(84px + env(safe-area-inset-bottom,0px))}
html.vue-tel .tabbar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:20;max-width:var(--cadre-tel);margin:0 auto;background:var(--surface);border-top:1px solid var(--line);padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px))}
html.vue-tel .tabbar a{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 0;color:var(--muted);font-size:11.5px;font-weight:500}
html.vue-tel .tabbar a svg{width:20px;height:20px}
html.vue-tel .tabbar a[aria-current="page"]{color:var(--accent)}

/* recopie de @media (max-width:900px), l. 209-218 : tableaux en fiches */
html.vue-tel table.data.stack thead{display:none}
html.vue-tel table.data.stack,html.vue-tel table.data.stack tbody,html.vue-tel table.data.stack tr{display:block}
html.vue-tel table.data.stack tr{padding:12px 16px;border-bottom:1px solid var(--line)}
html.vue-tel table.data.stack tr:last-child{border-bottom:0}
html.vue-tel table.data.stack td{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:4px 0;border:0;text-align:right}
html.vue-tel table.data.stack td[data-l]::before{content:attr(data-l);color:var(--muted);font-size:12.5px;text-align:left}
html.vue-tel table.data.stack td.first{justify-content:flex-start;text-align:left;padding-bottom:8px}
html.vue-tel table.data.stack .ctl{justify-content:flex-end}

/* recopie de @media (max-width:1180px), l. 184 et l. 490 */
html.vue-tel .ov{grid-template-columns:1fr}
html.vue-tel .home .feed-card{max-height:360px}
html.vue-tel .home .lots.scroll{overflow:visible}

/* recopie de @media (max-width:1100px), l. 306, 393-404, 421, 434 */
html.vue-tel .rf{grid-template-columns:1fr}
html.vue-tel .sticky{position:static}
html.vue-tel .dp-grid{grid-template-columns:1fr;grid-template-rows:none}
html.vue-tel .dp-chart,html.vue-tel .dp-journal,html.vue-tel .dp-devs,html.vue-tel .dp-side{grid-column:auto;grid-row:auto}
html.vue-tel .dp-chart{height:380px}
html.vue-tel .dp-journal{height:420px}
html.vue-tel .dp-side>.dp-params{flex:none}
html.vue-tel .dp-chart-body.with-side{flex-direction:column}
html.vue-tel .dp-chart.dp-chart:has(.with-side){height:auto}
html.vue-tel .dp-chart-body.with-side .dp-plot{height:260px;flex:none}
html.vue-tel .grav-side{width:auto;border-left:0;padding-left:0}
html.vue-tel .grav-list{max-height:240px}
html.vue-tel .dp-grid.arch .arch-2{height:320px}
html.vue-tel .dp-grid.arch .dp-devs{height:360px}

/* recopie de ≤ 1250 (3 col.), ≤ 760 (2 col.), ≤ 440 (1 col.) : valeur nette à 430 px */
html.vue-tel .outlets{grid-template-columns:1fr}

/* recopie de @media (max-width:640px) : seulement ce qui est vivant à 430 px */
html.vue-tel .fgrid{grid-template-columns:1fr}
html.vue-tel .types{grid-template-columns:1fr 1fr}
html.vue-tel .rrow:not(.step),html.vue-tel .rows-h{grid-template-columns:minmax(0,1fr) 96px 34px}
html.vue-tel .journal li.jl time{grid-column:1/-1}

/* neutralisation de @media (min-width:1101px) and (min-height:640px), l. 388-392 et 487-489 :
   à 1440 × 900 ce verrou fixerait .dp à la hauteur de la fenêtre */
html.vue-tel .dp{height:auto;min-height:0;display:block}

/* bouton enfoncé */
html.vue-tel #vueBtn{background:var(--accent-soft);border-color:var(--accent);color:var(--accent)}

/* ===== Tactile : téléphone (≤ 900 px, classe posée par le script) ou vue forcée ===== */
html:is(.tactile,.vue-tel){--cible:44px;--police-champ:16px}

html:is(.tactile,.vue-tel) .home-grid{grid-template-columns:minmax(0,1fr)}
html:is(.tactile,.vue-tel) .home .lots{grid-template-columns:repeat(auto-fill,minmax(min(250px,100%),1fr))}

html:is(.tactile,.vue-tel) .tabs{gap:0;padding:0 4px;overflow-x:auto;overflow-y:hidden;border-bottom:0;box-shadow:inset 0 -1px 0 var(--line);scrollbar-width:none}
html:is(.tactile,.vue-tel) .tabs::-webkit-scrollbar{display:none}
html:is(.tactile,.vue-tel) .tabs>button{flex:1 0 auto;height:auto;min-height:var(--cible);align-self:stretch;padding:0 8px;margin-bottom:0;white-space:nowrap}
html:is(.tactile,.vue-tel) .tabs .cnt{margin-left:4px}

html:is(.tactile,.vue-tel) .switch{width:56px;height:32px}
html:is(.tactile,.vue-tel) .switch::after{width:28px;height:28px}
html:is(.tactile,.vue-tel) .switch[aria-checked="true"]::after{transform:translateX(24px)}
html:is(.tactile,.vue-tel) .switch::before{content:"";position:absolute;left:0;right:0;top:calc((32px - var(--cible)) / 2);bottom:calc((32px - var(--cible)) / 2)}
html:is(.tactile,.vue-tel) .ctl{gap:16px}

html:is(.tactile,.vue-tel) .icon-btn{position:relative}
html:is(.tactile,.vue-tel) .icon-btn::before{content:"";position:absolute;inset:calc((34px - var(--cible)) / 2)}
html:is(.tactile,.vue-tel) .m-brand{position:relative}
html:is(.tactile,.vue-tel) .m-brand::before{content:"";position:absolute;inset:calc((28px - var(--cible)) / 2)}
html:is(.tactile,.vue-tel) .btn:not(.sm){height:var(--cible)}
html:is(.tactile,.vue-tel) .btn.sm{position:relative}
html:is(.tactile,.vue-tel) .btn.sm::before{content:"";position:absolute;left:0;right:0;top:calc((30px - var(--cible)) / 2);bottom:calc((30px - var(--cible)) / 2)}
html:is(.tactile,.vue-tel) .seg button{height:var(--cible)}
html:is(.tactile,.vue-tel) .stepper button{width:var(--cible);height:var(--cible)}
html:is(.tactile,.vue-tel) .crumbs a{display:inline-flex;align-items:center;min-height:var(--cible)}

html:is(.tactile,.vue-tel) :is(input[type=text],input[type=number],input[type=search],input[type=datetime-local],select){height:var(--cible)}
html:is(.tactile,.vue-tel) :is(input[type=text],input[type=number],input[type=search],input[type=datetime-local],select,textarea){font-size:var(--police-champ)}
html:is(.tactile,.vue-tel) .stepper input[type=number]{font-size:18px}

html:is(.tactile,.vue-tel) #journal-list li.jl{grid-template-columns:auto minmax(0,1fr);row-gap:4px}
html:is(.tactile,.vue-tel) #journal-list li.jl time{grid-column:1/-1}

@media (max-width:900px){
  /* la marge basse de sécurité est déjà dans .content (l. 95) : ne pas la compter deux fois */
  :root{padding-bottom:0}
  /* paysage : l'îlot dynamique et les bords arrondis mordent à gauche et à droite */
  .topbar{padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
  .content{padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
  .tabbar{padding-left:max(8px,env(safe-area-inset-left,0px));padding-right:max(8px,env(safe-area-inset-right,0px))}
  /* sans effet ici ; reste visible s'il est enfoncé, pour pouvoir sortir de la vue forcée */
  html:not(.vue-tel) #vueBtn{display:none}
}'''

BOUTON = '''        <button class="icon-btn" data-action="vue" id="vueBtn" aria-pressed="false" aria-label="Vue téléphone" title="Vue téléphone"></button>'''

ICONE_TEL = '''  tel: svgI('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),'''

ACTION_VUE = '''  if (act === 'vue') return basculerVue();'''

DEMARRAGE = '''document.getElementById('vueBtn').innerHTML = IC.tel;
appliquerVue();'''

# ---------------------------------------------------------------------------
# Opérations
# ---------------------------------------------------------------------------

OPERATIONS = [
    {
        "nom": '''script de tête (§2.1)''',
        "ancre": '''<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">''',
        "ligne_spec": 9,
        "position": '''apres''',
        "suivante": '''<style>''',
        "texte": SCRIPT_TETE,
        "debut": '''/* ---------- Vue téléphone ----------''',
        "fin": '''vueEtroite.addEventListener('change', appliquerVue);''',
    },
    {
        "nom": '''blocs A, B, C (§3, §4, §5)''',
        "ancre": '''@media (max-width:1360px){.home-grid{grid-template-columns:minmax(0,1fr) 300px}}''',
        "ligne_spec": 492,
        "position": '''apres''',
        "suivante": '''</style>''',
        "texte": BLOC_ABC,
        "debut": '''/* ===== Vue téléphone forcée''',
        "fin": '''html:not(.vue-tel) #vueBtn{display:none}''',
    },
    {
        "nom": '''bouton #vueBtn (§2.2)''',
        "ancre": '''        <button class="icon-btn" data-action="theme" id="themeBtn" aria-label="Changer de thème"></button>''',
        "ligne_spec": 511,
        "position": '''avant''',
        "suivante": None,
        "texte": BOUTON,
        "debut": '''data-action="vue" id="vueBtn"''',
        "fin": '''title="Vue téléphone"></button>''',
    },
    {
        "nom": '''icône « tel » (§2.3)''',
        "ancre": '''Object.assign(IC, {''',
        "ligne_spec": 865,
        "position": '''apres''',
        "suivante": None,
        "texte": ICONE_TEL,
        "debut": '''  tel: svgI(''',
        "fin": '''<path d="M11 18.5h2"/>'),''',
    },
    {
        "nom": '''action « vue » (§2.4)''',
        "ancre": '''  if (act === 'theme') return cycleTheme();''',
        "ligne_spec": 1668,
        "position": '''apres''',
        "suivante": None,
        "texte": ACTION_VUE,
        "debut": '''if (act === 'vue')''',
        "fin": '''return basculerVue();''',
    },
    {
        "nom": '''démarrage (§2.5)''',
        "ancre": '''applyTheme();''',
        "ligne_spec": 1773,
        "position": '''apres''',
        "suivante": None,
        "texte": DEMARRAGE,
        "debut": '''document.getElementById('vueBtn').innerHTML = IC.tel;''',
        "fin": '''appliquerVue();''',
    },
]


def lire_octets(chemin):
    if not os.path.isfile(chemin):
        raise Refus("fichier introuvable : %s" % chemin)
    with open(chemin, "rb") as f:
        return f.read()


def texte_depuis_octets(brut):
    if brut.startswith(b"\xef\xbb\xbf"):
        raise Refus("le fichier commence par un BOM UTF-8 (attendu : aucun)")
    try:
        texte = brut.decode("utf-8")
    except UnicodeDecodeError as e:
        raise Refus("le fichier n'est pas de l'UTF-8 valide : %s" % e)
    orphelins = texte.count("\n") - texte.count(CRLF)
    if orphelins:
        raise Refus("le fichier contient %d fin(s) de ligne LF non précédée de CR" % orphelins)
    return texte


def zone_style(lignes):
    ouvr = [i for i, l in enumerate(lignes) if l == "<style>"]
    ferm = [i for i, l in enumerate(lignes) if l == "</style>"]
    if len(ouvr) != 1 or len(ferm) != 1:
        raise Refus("<style> trouvé %d fois et </style> %d fois (attendu : 1 et 1)"
                    % (len(ouvr), len(ferm)))
    if ferm[0] < ouvr[0]:
        raise Refus("</style> précède <style>")
    return ouvr[0], ferm[0]


def equilibre_accolades(lignes):
    i, j = zone_style(lignes)
    css = CRLF.join(lignes[i + 1:j])
    return css.count("{"), css.count("}")


def statistiques(brut, lignes):
    texte = CRLF.join(lignes)
    ouvrantes, fermantes = equilibre_accolades(lignes)
    return {
        "octets": len(brut),
        "sha256": hashlib.sha256(brut).hexdigest(),
        "lignes": len(lignes) - (1 if lignes[-1] == "" else 0),
        "elements": len(lignes),
        "crlf": texte.count(CRLF),
        "lf_orphelins": texte.count("\n") - texte.count(CRLF),
        "bom": brut.startswith(b"\xef\xbb\xbf"),
        "script": texte.count("<script>"),
        "script_fin": texte.count("</script>"),
        "style": texte.count("<style>"),
        "style_fin": texte.count("</style>"),
        "acc_ouvrantes": ouvrantes,
        "acc_fermantes": fermantes,
    }


def ecrire_rapport(titre, st):
    print(titre)
    for cle, val in (
        ("octets", st["octets"]),
        ("sha256", st["sha256"]),
        ("lignes", st["lignes"]),
        ("fin(s) de ligne CRLF", st["crlf"]),
        ("LF orphelins", st["lf_orphelins"]),
        ("BOM", "oui" if st["bom"] else "non"),
        ("<script>", st["script"]),
        ("</script>", st["script_fin"]),
        ("<style>", st["style"]),
        ("</style>", st["style_fin"]),
        ("accolades { dans <style>", st["acc_ouvrantes"]),
        ("accolades } dans <style>", st["acc_fermantes"]),
    ):
        print("  %-26s %s" % (cle, val))


def trouver_sous_liste(lignes, bloc):
    n = len(bloc)
    if n == 0:
        return []
    return [i for i in range(len(lignes) - n + 1) if lignes[i:i + n] == bloc]


def main(argv):
    chemin = argv[1] if len(argv) > 1 else FICHIER_DEFAUT
    print("fichier : %s" % chemin)
    brut = lire_octets(chemin)
    texte = texte_depuis_octets(brut)
    lignes = texte.split(CRLF)
    st_avant = statistiques(brut, lignes)
    ecrire_rapport("=== avant ===", st_avant)

    presentes = [op for op in OPERATIONS if op["texte"].replace("\n", CRLF) in texte]
    absentes = [op for op in OPERATIONS if op not in presentes]

    if not absentes:
        print("")
        print("aucun changement : les %d insertions sont déjà présentes, fichier laissé intact."
              % len(presentes))
        for op in presentes:
            print("  - %s" % op["nom"])
        return 0

    for op in absentes:
        for cle in ("debut", "fin"):
            if op[cle] in texte:
                raise Refus("état incohérent pour « %s » : le marqueur %s est présent alors que "
                            "le bloc complet ne l'est pas ; rien n'a été écrit"
                            % (op["nom"], cle))

    plan = []
    for op in absentes:
        indices = [i for i, l in enumerate(lignes) if l == op["ancre"]]
        if len(indices) != 1:
            raise Refus("ancrage de « %s » trouvé %d fois (attendu : exactement 1) ; "
                        "rien n'a été écrit" % (op["nom"], len(indices)))
        i = indices[0]
        if op["suivante"] is not None:
            if i + 1 >= len(lignes) or lignes[i + 1] != op["suivante"]:
                raise Refus("après l'ancrage de « %s » (ligne %d), la ligne attendue %s est "
                            "absente ; rien n'a été écrit" % (op["nom"], i + 1, repr(op["suivante"])))
        if i + 1 != op["ligne_spec"]:
            print("AVERTISSEMENT : l'ancrage de « %s » est à la ligne %d, la spec annonce la ligne %d."
                  % (op["nom"], i + 1, op["ligne_spec"]))
        plan.append((op, i))

    plan.sort(key=lambda p: p[1], reverse=True)
    for op, i in plan:
        bloc = op["texte"].split("\n")
        pos = i + 1 if op["position"] == "apres" else i
        lignes = lignes[:pos] + bloc + lignes[pos:]

    nouveau = CRLF.join(lignes).encode("utf-8")
    temporaire = chemin + ".applique-mobile.tmp"
    with open(temporaire, "wb") as f:
        f.write(nouveau)
    os.replace(temporaire, chemin)
    brut2 = lire_octets(chemin)
    lignes2 = texte_depuis_octets(brut2).split(CRLF)
    if brut2 != nouveau:
        raise Refus("le contenu écrit ne correspond pas au contenu calculé")
    st_apres = statistiques(brut2, lignes2)
    ecrire_rapport("=== après ===", st_apres)

    acc = (BLOC_ABC.count("{"), BLOC_ABC.count("}"))
    delta = (st_apres["acc_ouvrantes"] - st_avant["acc_ouvrantes"],
             st_apres["acc_fermantes"] - st_avant["acc_fermantes"])
    if delta != acc:
        raise Refus("les accolades de <style> ont varié de %s alors que le CSS inséré en compte %s"
                    % (delta, acc))
    for cle, avant_voulu, apres_voulu in (("script", 1, 2), ("script_fin", 1, 2),
                                          ("style", 1, 1), ("style_fin", 1, 1)):
        if st_avant[cle] != avant_voulu or st_apres[cle] != apres_voulu:
            raise Refus("%s : %d avant, %d après (attendu : %d avant, %d après)"
                        % (cle, st_avant[cle], st_apres[cle], avant_voulu, apres_voulu))
    if st_apres["lf_orphelins"] or st_apres["bom"]:
        raise Refus("fins de ligne ou BOM altérés après écriture")
    if lignes2.index("<script>") > lignes2.index("<style>"):
        raise Refus("le script de tête n'est pas placé avant la feuille de style")

    print("")
    print("insertions (numéros de ligne dans le fichier final) :")
    for op in sorted(OPERATIONS, key=lambda o: o["ligne_spec"]):
        bloc = op["texte"].split("\n")
        positions = trouver_sous_liste(lignes2, bloc)
        if len(positions) != 1:
            raise Refus("« %s » : bloc trouvé %d fois dans le fichier final (attendu : 1)"
                        % (op["nom"], len(positions)))
        print("  - %-28s lignes %d à %d (%d ligne(s))"
              % (op["nom"], positions[0] + 1, positions[0] + len(bloc), len(bloc)))
    print("")
    print("OK : %d insertion(s) appliquée(s), %d déjà présente(s)." % (len(absentes), len(presentes)))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv))
    except Refus as e:
        print("REFUS : %s" % e, file=sys.stderr)
        sys.exit(1)
