# Revue qualité — `hakko-dashboard.html` (FermentationLab2)

Relecteur : Opus. Date : 2026-09-23.
Objet : origine B `http://127.0.0.1:8812/hakko-dashboard.html` (identique octet pour octet à la référence A,
fait établi, non re-vérifié). **Tous les défauts cités ci-dessous existent donc aussi dans la référence et dans
l'annexe C du README** : ce sont des défauts du code de référence ou des incohérences entre la prose du README
(§1–§10) et ce code.

Méthode : 8 sondes Puppeteer (Edge headless shell, contexte navigateur neuf à chaque fois, 1440×860),
passées à `node.exe --input-type=module` par l'entrée standard (aucun fichier créé dans le projet). Les textes
sont lus dans le DOM (`innerText`/`textContent`), les valeurs brutes dans l'état `S`. Quand l'état a été
injecté plutôt que produit par l'interface, c'est dit explicitement. Les résultats de `_verify/RAPPORT.md`
sont repris tels quels, sans être refaits.

Numéros de ligne : ceux de `hakko-dashboard.html` (= `_verify/reference-original.html`). Les règles sont
citées par `README.md:ligne`.

---

## 1. Ce qui est correct, à conserver

- **Jetons §3.1** : les 29 jetons du tableau `README.md:64-87`, en clair **et** en sombre, sont égaux aux
  valeurs calculées (`getComputedStyle(:root)`) :
  `TOKENS {"nbJetons":29,"ecarts":[]}`
- **Dimensions §3.2/§3.3/§6.2** mesurées : barre latérale 236 px, barre haute 60 px, `.dp-title h1` 21 px/600,
  `.ph h1` 22 px, `.card-h h2` 14 px/600, KPI 26 px (20 px en compact), `small` 14 px/500, boutons 36/30 px,
  champ 36 px, rayons carte 10 / bouton 7 / badge 5 / dialog 12 / tuile de lot 8 / prise 10, badge 22 px,
  point 6 px, carré de type 8×8 r2, barre 6 px, interrupteur 36×20, onglets 44 px (42 px dans le graphique),
  grille du détail `1.7fr 1fr 320px` / `1.3fr 1fr` / 14 px, panneau Densité 340 px, bouton de prise 44 px/700.
  La grille des lots fait bien 2 colonnes aux deux viewports cibles (`374px 374px` à 1440, `314px 314px` à 1280) ;
  la capture `Accueil.png` en montre 3, mais elle est prise sur un écran plus large (≈1850 px) où `auto-fill`
  en place 3, ce qui est cohérent.
- **Chiffres de l'accueil recalculés indépendamment** (formules §7/§8 réécrites dans la sonde, sans passer par
  les fonctions de l'appli) : badge d'état, température, libellé de progression et pourcentage identiques pour
  les 4 lots, par exemple :
  `b2 affiche "Écart léger" | "Semaine 21 sur 53" "39 %"` — recalcul `"Écart léger"`, écart 2,571 > tol/2 = 2 ;
  `b3 affiche "26 h sur 48 h" "54 %"` — recalcul identique ; KPI `10/11` = recalcul `"enLigne":"10/11"`.
- **Détail b1** : `Alcool estimé 6,6%` et `Atténuation 86 %` = recalcul `abv 6.563`, `att 86.21` ;
  tableau des relevés : alcool par ligne = `(1,058 − g) × 131,25` sur les 6 lignes (`1,016 → 5,5 %` pour 5.51, etc.).
- **Journal** : l'écart affiché vaut bien `tp − tg` (`24,2 °C (+0,2 °C)` pour `d: 0.217`, `23,8 °C (−0,2 °C)` pour
  `d: -0.211`) et le signe négatif est U+2212 (`"minus":["2b","2212","2b","2212"]`).
- **Statistiques d'archive b0** recalculées par un échantillonnage uniforme indépendant (20 000 points dans
  `[start, end]`) : moyenne 19,224 contre 19,222 (appli), écart-type 0,440 contre 0,439, min/max 18,69/20,64 contre
  18,69/20,64, dans la plage 81,4 % contre 81,5 %. Affichage `19,2 °C / 19,0` et badge `82 %` en `warn` (70 ≤ x < 90) : conforme à §6.3.
- **Lot de moins de 3 jours** (b3) : périodes proposées `["24 h","Tout"]`, conforme à `README.md:242`.
- **Bière sans relevé** (b1 après suppression des 6 relevés) : l'onglet Densité reste, le graphique affiche
  `Pas encore de mesure.`, la tuile d'accueil repasse en `Chauffe Veille`, et les KPI Densité et Alcool disparaissent. Pas d'erreur.
- **Recherche sans résultat dans l'archive** : `Aucun lot ne correspond aux filtres`.
- Aucune `pageerror` dans les 8 sondes (`pageerrors []` à chaque fois).

---

## 2. Défauts

Aucun défaut **bloquant** : les 8 points de §10 passent (RAPPORT.md §4), à l'exception de M7 ci-dessous.

### Majeurs

**M1. Une prise en mode auto reste allumée indéfiniment quand le lot n'a plus de sonde.**
`hakko-dashboard.html:672-673` : `tp = currentTemp(b)` vaut `null` sans sonde en ligne, et `if (tp != null){…}` ne
touche alors plus à `d.on`. Règle : `README.md:332` (la prise auto « s'éteint si `tp > consigne + 0,2` »). Sans mesure,
la régulation est figée dans son dernier état, y compris « allumée ».
Preuve (actions faites dans l'interface : consigne de b4 portée à 62 °C, puis sonde t4 détachée dans Appareils, puis 3 ticks) :
```
APRES CONSIGNE 62 {"p3":{…"mode":"auto","on":true,…"power":419.45…},"kpis":[…"Chauffage | Active | …"]}
3 TICKS APRES RETRAIT SONDE {"p3":{"on":true,"mode":"auto","power":410.75…,"batch":"b4"},"t4batch":null}
TUILE b4 SANS SONDE {"badge":"…Sans sonde</span>","cells":["Température —°C","Cible 62,0°C","Chauffe Active"],
  "kpis":[…,"Chauffe active | 1prises | 412 W consommés"]}
```
Correctif : dans `tick()`, forcer `d.on = false` (et journaliser) quand `tp == null` pour une prise en mode auto.

**M2. Un relevé daté avant le début du lot est déplacé sans prévenir, et sa suppression efface aussi le relevé initial (OG).**
`hakko-dashboard.html:1139` (pas d'attribut `min`), `:1530` (`Math.max(t, b.start)` silencieux), `:1494` (suppression
par horodatage : `filter(g => String(g[0]) !== a.dataset.t)`). Règle : `README.md:244` (« bornée entre le début du lot et
maintenant ») et `README.md:245` (un ✕ supprime **un** relevé).
Preuve (b1, saisie `1.050` au `2026-09-01T10:00`, puis ✕ sur la seule ligne 1,050) :
```
A1 gravity [[1789344485738,1.058],[1789344485738,1.05],["start",1789344485738]]
A1 lignes […,"14 sept., 02:08\t1,058\t0,0 %","14 sept., 02:08\t1,050\t1,1 %"]
A2 après ✕ sur 1,050 ["23 sept., 02:08\t1,008…", …,"15 sept., 14:08\t1,047\t1,4 %"]   ← 1,058 a disparu aussi
```
Correctif : poser `min="${dtLocal(b.start)}"` sur le champ, et supprimer par index (ou par un identifiant) plutôt que par horodatage.

**M3. Le journal d'une fiche d'archive n'est pas figé : ses entrées de chauffe disparaissent au fil des nouveaux événements.**
`hakko-dashboard.html:876` (`S.events` plafonné à 500, tous lots confondus) et `:1149` (le journal d'archive est
relu dans `S.events` à chaque rendu). Règle : `README.md:272` (« Journal figé »).
Preuve (b4 terminé, puis 500 appels à `logEvent`, la fonction utilisée par l'application ; **volume injecté**) :
```
4 journal archive b4 : entrées avant 12 après 500 événements {"li":1,"texte":"3 sept., 09:20\nNote\nBroyage champignons…"}
```
Ordre de grandeur réel : au démarrage, on compte 25 événements, dont 22 de chauffe, sur 32,5 h
(`{"n":25,"heat":22,"span_h":"32.5"}`). Le plafond de 500 est donc atteint en quelques semaines d'usage normal.
Correctif : copier les événements du lot dans `b` au moment de « Terminer le lot » (comme `devSnap`) et bâtir le journal d'archive à partir de cette copie.

**M4. Les fiches d'archive et les recettes archivées sont inaccessibles au clavier.**
`hakko-dashboard.html:1372` et `:1179` (lignes `tr.click` sans lien, sans `tabindex` ni rôle) et `:1478`
(navigation uniquement au `click`). Aucune autre route ne mène à `#/archive/b0`.
Preuve :
```
C1 archive : focusables dans les lignes [{"href":"#/archive/b0","tabindex":null,"role":null,"focusables":0}]
C1 liens vers #/archive/b0 dans toute l'appli {"#/archive":0,"#/recettes/r5":0,"#/":0}
C1 ordre de tabulation après la recherche ["BUTTON[atype=all]",…,"BUTTON[atype=garum]","BODY","A(#/)","A(#/)"]
```
Correctif : mettre un `<a href="…">` dans la première cellule de chaque ligne `data-href`, en gardant le clic sur toute la ligne.

**M5. La KPI « Chauffe » d'une fiche d'archive peut afficher un pourcentage de temps supérieur à 100 %.**
`hakko-dashboard.html:1339-1345` : le pas `st = max(5 min, span/20000)` est ajouté en entier à `onMs`, même quand
il dépasse la durée restante, puis `duty = onMs / span * 100`. Règle : `README.md:268` et `README.md:339`
(« % du temps »).
Preuve (recette lancée, sonde t3 et Prise 4 reliées, lot terminé au bout d'environ 5,7 s ; tout fait dans l'interface) :
```
C KPI archive […,"Chauffe | 0h | 1 activations, 5298 %"]
C archStats.heat {"spanMs":5663,"heat":{"acts":1,"hours":0.0833…,"duty":5297.5…}}
```
Correctif : ajouter `Math.min(st, end − t)` au lieu de `st` (et plafonner `duty` à 100).

**M6. Sur l'onglet Humidité, le choix de période (24 h / Tout) est affiché mais n'a aucun effet.**
`hakko-dashboard.html:786` (`humCfg` prend toujours `from = b.start` et ignore `detailRange`) ; `:1096`
(le sélecteur n'est masqué que sur l'onglet Densité). Règle : `README.md:242` (la période n'est masquée **que** sur l'onglet Densité).
Preuve (b3, onglet Humidité) :
```
HUM 24h  {"pressed":"24 h=true Tout=false","xlabels":["07:19","15:59","00:39","09:19"],"firstPt":"M46.0 77.8L51.9 73.7…","cfgFrom":"22/09/2026 07:19:16"}
HUM Tout {"pressed":"24 h=false Tout=true","xlabels":["07:19","15:59","00:39","09:19"],"firstPt":"M46.0 77.8L51.9 73.7…","cfgFrom":"22/09/2026 07:19:16"}
TEMP 24h x ["09:19","17:19","01:19","09:19"]   ← l'onglet Température, lui, respecte 24 h
```
Correctif : dans `humCfg`, calculer `from` à partir de `detailRange`, comme le fait `tempCfg` (`:776-777`).

**M7. À 1280×720, le graphique Densité de la fiche d'archive déborde de sa cellule de 18,4 px (fait acquis du harnais).**
`hakko-dashboard.html:703` (`H = Math.max(120, el.clientHeight)`) combiné à `:433` (`.dp-grid.arch .arch-2{overflow:visible}`).
Règle : `README.md:366` (§10.2) et `README.md:355-356` (§9).
Preuve : `_verify/RAPPORT.md:522-527`, sur B, en clair et en sombre :
`{"el":"div.dp-chart-body > div.dp-plot > div#arch-2.chart.fill > svg","px":18.4,"cote":"bas"}` (les étiquettes J1…J6 recouvrent la légende).
Correctif : supprimer le plancher de 120 px pour `.fill` (ou réduire la hauteur minimale des cellules de `.dp-grid.arch`) et retirer `overflow:visible`.

### Mineurs

**m1. Des nombres s'affichent avec un point décimal au lieu d'une virgule.**
`hakko-dashboard.html:693` (`sur ${dur}`), `:1077` et `:1415` (`r.salt + ' %'`), `:1178` (`${r.salt} % sel`,
`${r.hum} % HR`) ; même construction à `:1059`, `:1076`, `:1414`, `:789`. Règle : `README.md:21` (virgule décimale)
et `README.md:310`. Ces champs acceptent des pas de 0,5 (`:1220`, `:1226`).
Preuve (recette miso, durée 10,5 j, sel 10,5 %, créée et lancée dans l'interface) :
```
B1 liste recettes ["Test décimal | Miso\t11 jours\t20,0 °C\t10.5 % sel\t0\t—"]
B2 progression ["Jour 1 sur 10.5"]
B2 KPI […,"Salinité | 11% | Du poids total",…]      B2 paramètres […,"Durée prévue","11 jours",…,"Salinité","10.5 %",…]
```
La même page affiche donc à la fois « 11 % » et « 10.5 % », ainsi que « 11 jours » et « sur 10.5 ».
Correctif : passer toutes ces valeurs par `fmt()` (avec 0 ou 1 décimale selon le cas).

**m2. Le signe moins est le trait d'union ASCII pour les valeurs négatives, et un « −0,0 » peut apparaître.**
`hakko-dashboard.html:524` (`toFixed` produit `-`), utilisé par `:1058`, `:1115`, `:1119` et `:1158` ; `:925` (le signe
est choisi avant l'arrondi). Règle : `README.md:250` (« vrai signe moins »).
Preuve (consigne −1 °C saisie dans l'interface pour une garde à froid, puis KPI de b1) :
```
B {"kpi":"Consigne | -1,0°C | …","actuelle":"Actuelle -1,0 °C","hint":"Chauffe active sous -1,2 °C, coupée au-dessus de -0,8 °C.",
   "journal":["… | Consigne | Consigne modifiée de 24,0 °C à -1,0 °C", …],"codes":["2d","2d","2d"]}
DETAIL b1 "kpis":["Température | 24,0°C | −0,0 °C vs cible", …]   (écart réel −0,044)
```
Correctif : dans `fmt`, remplacer `-` par `−` et normaliser `−0` ; dans `live('delta')`, tester le signe après arrondi.

**m3. La tolérance affichée est arrondie, ce qui contredit le badge d'état.**
`hakko-dashboard.html:1058` et `:1401` (`fmt(tol/2, 1)`). Règle : `README.md:154` et `README.md:335` (±`tol/2` exact).
Preuve : `"Consigne | 62,0°C | Tolérance ±0,8 °C"` pour le garum (tol/2 = 0,75) et `"Tolérance ±1,3 °C"` pour le
koji (1,25). Un écart de 0,78 °C est donc affiché « Écart léger » alors que la page annonce ±0,8.
Correctif : afficher `fmt(tol/2, 2)`, ou `fmt` avec 2 décimales quand la troisième n'est pas nulle.

**m4. Au-delà de l'échéance, la progression n'est pas plafonnée pour les lots courts et longs.**
`hakko-dashboard.html:691-692` ; le cas « Jour » est plafonné à `:693`. Règle : `README.md:312-315`.
Preuve (horloge avancée de 30 h, b3 koji de 48 h) :
`2 b3 +30 h {"prog":"56 h sur 48 h", …}` et `2 tuile b3 +30 h "56 h sur 48 h | 100 %"`.
Correctif : appliquer `Math.min(…, total)` aux deux branches, comme pour « Jour ».

**m5. Plusieurs libellés ont une faute d'accord.**
`hakko-dashboard.html:1012` (`prévus`), `:1031` (`prises`), `:1439` (`notes`), `:1408` (`activations`).
Règle : `README.md:6` (textes en français).
Preuve DOM : `"Démarrée le 4 mai, 1 an prévus"`, `"Chauffe active | 1prises | 160 W consommés"`,
`"Journal | 1 notes"`, `"1 activations, 5298 %"`. Les captures `Accueil.png` et `…084520.png` montrent les mêmes textes dans la référence.
Correctif : accorder selon le nombre (`n > 1 ? 's' : ''`, et « prévu » au singulier avec « 1 an »).

**m6. Une sonde hors ligne reliée au lot est annoncée comme absente, et la courbe « Mesure » est tracée sans aucune sonde.**
`hakko-dashboard.html:651` et `:923` (le texte `Aucune sonde reliée` couvre aussi le cas « reliée mais hors ligne ») ;
`:778` (la courbe est simulée même sans sonde). Règle : `README.md:338` (« sans sonde → Sans sonde »).
Preuve (Sonde cave, hors ligne, reliée à b4 dans l'interface) :
```
DETAIL b4 AVEC SONDE HORS LIGNE {"kpis":["Température | —°C | Aucune sonde reliée"],"devs":["Prise étuve garum Mode auto 412 W","Sonde cave Hors ligne —"]}
DETAIL b4 SANS SONDE {… "chartPts":161}   (courbe « Mesure » de 161 points alors qu'aucune sonde n'est reliée)
```
Correctif : distinguer « Sonde hors ligne » de « Aucune sonde reliée », et ne pas tracer la série « Mesure » sans sonde.

**m7. Une prise peut rester en mode « Auto » sans être reliée à un lot.**
`hakko-dashboard.html:1488` (Terminer le lot ne remet pas `mode`), `:1515` (dissociation) et `:1259` (le tableau propose
« Auto » même sans lot). Règle : `README.md:301` (« Auto (consigne) » désactivé si la prise n'est reliée à rien).
Preuve :
```
3 Prise 3 après clôture {"fermentation":"Non relié","modeValue":"auto","modeTexte":"Auto (consigne)","optionSelectionneeDesactivee":true,…}
3 options du mode (tableau) pour Prise 5 ["Auto","Manuel"]  →  3 tuile Prise 5 {"value":"auto",…,"desactivee":true}
```
Correctif : passer `mode` à `'manuel'` quand `batch` devient `null`, et désactiver « Auto » dans le tableau dans ce cas.

**m8. Une sixième prise est invisible dans l'onglet Prises, qui en annonce pourtant 6.**
`hakko-dashboard.html:1544` (aucun emplacement libre, donc pas de `slot`), `:1273`, `:1291` (l'onglet Prises n'affiche que la multiprise).
Règle : `README.md:293` (compteurs d'onglets) et `README.md:296-297`.
Preuve : `G onglets [… ,"Prises6"] tuiles 5 ["5 prises, allumées : 0, puissance : 0 W"] prise6.slot= undefined`.
Correctif : lister sous la multiprise les prises sans emplacement, ou refuser d'ajouter une prise quand la multiprise est pleine.

**m9. Une bière sans OG crée un relevé vide et affiche un alcool estimé de 0,0 %.**
`hakko-dashboard.html:1505` (relevé `[now, r.og]` même si `og` vaut `null`) et `:1061`. La validation `:1549-1553` n'exige pas l'OG.
Preuve :
```
2 KPI […,"Densité | — | Visée 1,010","Alcool estimé | 0,0% | Atténuation 0 %",…] gravity [[1790148228123,null]]
2 relevés ["23 sept., 09:23\t—\t0,0 %"]  axe Y ["0,000","0,500","1,000",…]
```
Correctif : exiger l'OG pour une bière (dans `#ferr`), ou ne pas créer de relevé initial quand l'OG est vide.

**m10. La numérotation d'un nouveau lot peut régresser.**
`hakko-dashboard.html:1504` (`n = nombre de lots de la recette + 1`). Règle : `README.md:288` (« `<recette> #n` »).
Preuve : `E nom du lot lancé ["Saison du Nord #2"] lots r1: ["Saison du Nord #3","Saison du Nord #2"]`.
Correctif : prendre n = 1 + le plus grand `#k` existant pour cette recette.

**m11. Une durée inférieure à 0,5 jour est acceptée.**
`hakko-dashboard.html:1210` (`novalidate`), `:1552`. Règle : `README.md:159` (`duration … 0.5 min`).
Preuve : `{"hash":"#/recettes","recette":{"duration":0.1},"ligne":"Durée 0,1 Bière 2 h 20,0 °C …"}`.
Correctif : rejeter `duration < 0.5` avec un message dans `#ferr`.

**m12. [Spec ↔ code] Le garum a un bruit de mesure amplifié, et non réduit.**
`hakko-dashboard.html:645` (`temp += n * 0.6` s'ajoute au `+ n` de `:637`, soit 1,6 × n). Règle : `README.md:327` (« garum : bruit réduit »).
Preuve : `4 garum ["1.6000","1.6000","1.6000","1.6000","1.6000","1.6000"]` (rapport `(model − tgt)/n` mesuré à 6 instants).
Correctif : `temp = T0 + n * 0.6` pour le garum, ou corriger la prose.

**m13. [Spec ↔ code] Les puissances simulées ne sont pas celles de §8.**
`hakko-dashboard.html:675` (`160 + random*12` ; les 410 W sont attachés à l'identifiant `p3` et non à l'étuve),
`:912` (une prise éteinte affiche `0 W`). Règle : `README.md:333` (160 W, 410 W pour l'étuve, 0,4 W éteinte).
Preuve : `"power":419.45…` et `"412 W consommés"` pour p3 ; `6 puissance éteinte {"power":0.4,"affiche":"0 W"}`.
Correctif : aligner la prose sur le code (« 160–172 W, 410–422 W pour p3 ; affiché 0 W éteinte ») ou l'inverse.

**m14. [Spec ↔ code] Le point vert « pulsé » du pied de barre latérale est fixe.**
`hakko-dashboard.html:74` (`.pulse` sans animation). Règle : `README.md:136`.
Preuve : `E .pulse animation {"animationName":"none","animationDuration":"0s"}`.
Correctif : ajouter une animation `@keyframes` sur le halo, ou retirer « pulsé » de la prose.

**m15. [Spec ↔ code] Plusieurs libellés diffèrent de §6.4 et §6.5.**
`hakko-dashboard.html:1408` (`.replace(' du temps', '')` retire le texte que §6.4 annonce) ; `:1240` et `:1241`.
Règles : `README.md:268` (« % du temps »), `README.md:285` (« Archiver » ou « Restaurer », « Historique des lots »).
Preuve DOM : `"34 activations, 34 %"` ; boutons `Archiver la recette` / `Restaurer la recette` ; titre `Historique`.
Correctif : aligner la prose sur les libellés réels (l'annexe fait foi, `README.md:6`) et supprimer le `.replace` qui ne sert à rien.

**m16. Accessibilité : la liste d'onglets contient des boutons qui ne sont pas des onglets, et le focus est perdu après chaque action qui redessine la vue.**
`hakko-dashboard.html:1095-1096` (le sélecteur de période est à l'intérieur de `role="tablist"`, et aucun onglet n'a d'`aria-controls`) ;
`:1483`, `:1495-1498` (`render()` sans restauration du focus).
Preuve :
```
C2 enfants de role=tablist ["tab:Température sans aria-controls","tab:Densité sans aria-controls","(aucun rôle):24 h …","(aucun rôle):7 j …","(aucun rôle):Tout …"]
C3 focus après Entrée sur onglet Densité BODY      C3 focus après Entrée sur filtre Miso BODY
```
Correctif : sortir `.tabs-end` du `tablist`, et après `render()` remettre le focus sur le contrôle `[data-action][data-v]` équivalent.

**m17. Accessibilité : le texte en `--faint` n'atteint pas le contraste AA.**
`hakko-dashboard.html:13` (`--faint:#9CA3AF`), utilisé pour du texte de 12 px à `:178` (« il y a … ») et `:276`
(heures du journal). Pas de règle README ; critère WCAG 1.4.3 (4,5:1).
Preuve : `"clair":{"faint_sur_surface":["#9CA3AF","#FFFFFF","2.54"]}`, `"sombre":{…"3.65"}`, `.nav-sec` `"3.91"` ;
`"il y a 4 s → rgb(156, 163, 175) / 12px"`.
Correctif : utiliser `--muted` (4,83:1 en clair, 5,77:1 en sombre) pour ces textes. Cela modifie la palette et doit donc être arbitré contre `README.md:6`.

**m18. Une recette sans ingrédient ni étape laisse des intertitres vides dans la fiche d'archive.**
`hakko-dashboard.html:1446-1449`. Règle : `README.md:273`.
Preuve : `C résumé [… "Appareils utilisés | Sonde chambre koji | Prise 4 | Ingrédients | Étapes"]` (rien sous les deux intertitres).
Correctif : masquer l'intertitre ou afficher « Aucun ingrédient » / « Aucune étape ».

**m19. Une recherche de recette sans résultat propose de créer une recette.**
`hakko-dashboard.html:1195`. Preuve : `F recettes ["Aucune recette ne correspond aux filtres | Créez une recette avec le bouton Nouvelle recette."]`
(l'archive affiche seulement `Aucun lot ne correspond aux filtres`).
Correctif : n'afficher l'aide que lorsque aucun filtre ni aucune recherche n'est actif, comme à `:1389`.

**m20. `ago` produit « il y a 60 min » et « il y a 24 h » à ses bornes.**
`hakko-dashboard.html:538-539` (l'arrondi est appliqué avant le changement d'unité). Règle : `README.md:317`.
Preuve : `5 ago ["il y a 60 min","il y a 24 h","il y a 2 h"]` pour 59,6 min, 23,6 h et 1,5 h.
Correctif : changer d'unité sur la valeur arrondie (`Math.round(s/60) < 60`, etc.).

**m21. `archStats` échantillonne avant le début du lot.**
`hakko-dashboard.html:1326` (`Math.min(end, …)` borne la fin mais pas le début). Règle : `README.md:339` (« 161 points sur la durée du lot »).
Preuve : `"premierSousEchantillon_h_avant_debut":"1.05"` pour b0. L'effet sur les chiffres de b0 est négligeable
(voir la section 1), mais min et max peuvent intégrer des instants hors du lot.
Correctif : `Math.max(b.start, Math.min(end, …))`.

**m22. Une prise hors ligne n'a aucun libellé textuel d'état (état injecté).**
`hakko-dashboard.html:1274-1279` : seules l'opacité (`.off`) et le « — » signalent l'état, et les deux sélecteurs restent actifs.
Preuve (**`online=false` injecté sur p1**, aucun chemin de l'interface ne le permet) :
`{"classes":"outlet  off","btnDisabled":true,"selectsDisabled":[false,false],"etat":"(aucun libellé « Hors ligne » dans la tuile ? true)"}`.
Correctif : afficher le badge `Hors ligne` dans `.o-top` et désactiver les sélecteurs.

---

## 3. Ce que je n'ai pas pu vérifier, et pourquoi

- **KPI « Écarts de température » figée entre deux rendus** (`hakko-dashboard.html:1029` : seul `.v` porte `data-live`,
  pas le sous-texte `.s`). Je n'ai pas pu produire l'incohérence visible. Sur 400 jours simulés, puis sur 5 jours
  avec les consignes de b2 et b3 réalignées, `kpiVal('alerts')` n'atteint jamais 0 (`premier instant sans écart : + null h`).
  Cause : le modèle koji (`:642`) fixe la température à consigne + 1,8 °C en régime établi, ce qui dépasse tol/2 = 1,25.
  Pour cette raison, le défaut n'est pas classé.
- **Espace insécable avant `°C` et `%`** : `README.md` ne l'exige nulle part, ce n'est donc pas un défaut au sens de la
  spécification. Constat : aucune occurrence de U+00A0 ni de U+202F dans `hakko-dashboard.html` (grep vide).
- **Captures** : je les ai utilisées pour la mise en page et comme corroboration seulement (par exemple les « 414 W »,
  « 163 W » de `…084723.png` rejoignent m13). Aucune affirmation de ce rapport ne repose sur un texte lu dans une image.
  Les captures ont été prises sur un écran d'environ 1850–1910 px ; je ne les ai pas comparées pixel à pixel.
- **Responsive sous 1100 px et 900 px** (barre d'onglets, tableaux `.stack`) : pas exercé, comme dans le harnais.
- **Prise hors ligne** : aucun chemin de l'interface ne met une prise hors ligne. m22 repose sur un état injecté.
- **Lecteurs d'écran réels** : l'accessibilité est vérifiée par rôles et attributs ARIA, ordre de tabulation et
  contrastes calculés, pas avec NVDA ni Narrateur.
- **Portabilité** : Edge headless uniquement. Le format des dates (`toLocaleDateString('fr-FR')`) dépend d'ICU et
  n'a pas été vérifié sous Firefox ni Safari.
- **Thème sombre dans les sondes fonctionnelles** : les sondes tournent en thème automatique (clair en headless) ;
  les jetons sombres sont vérifiés par la valeur calculée (section 1).
