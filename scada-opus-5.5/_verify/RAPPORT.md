# RAPPORT — harnais de vérification headless Hakko

Harnais : `_verify/verifie.mjs` (Node ESM, `puppeteer-core` 25.11.0 déjà installé, Edge `headless:'shell'`).
Toutes les sorties ci-dessous sont **collées depuis les fichiers de log** produits par les exécutions
(`_verify/run-*.log`), sans retouche.

## 0. Ce que fait le harnais (résumé technique)

- Arguments : `--a URL`, `--b URL` (facultatif), `--sortie DOSSIER`, `--cible a|b|deux`.
- Code de sortie : `0` tout passe, `1` au moins une assertion échoue, `2` une cible demandée est indisponible
  (B en 404 n'est **pas** compté comme échec de l'application ; B est réessayé une fois en fin de course).
- Écouteurs attachés avant `goto` : console `error`/`warn` (favicon filtré), `pageerror` avec `e.stack`,
  réponses ≥ 400, requêtes échouées, et boîtes de dialogue (acceptées, message conservé).
- **Passe 1 (mise en page)** : 2 viewports (1440×860, 1280×720) × 2 thèmes × 8 routes
  (`#/`, `#/f/b1`, `#/archive`, `#/archive/b0`, `#/recettes`, `#/recettes/new`, `#/appareils`
  + `#/recettes/r1`, ajoutée pour couvrir les « 4 sous-pages » de §10.1). Chaque cas dans un contexte
  navigateur neuf (localStorage vierge), `prefers-color-scheme` émulé **avant** le `goto` + clé `hakko-theme`.
  Attente d'un vrai tick (changement du texte `#syncTop`), puis mesures : delta de défilement vertical/horizontal
  du document (et `scrollTo` réel), débordements enfant→parent (parents non défilants/non coupants, éléments
  `display:none`/`visibility:hidden`/opacité 0/rect nul exclus, dépassement vertical des éléments `inline` ignoré),
  éléments hors viewport sans conteneur défilant, thème effectif (`--bg`), capture PNG.
  Horloge virtuelle commune à A et B (`Date.now` = base fixe + `performance.now()`, `Math.random` graine fixe)
  pour que A et B produisent les mêmes données simulées et soient comparables.
- **Passe 2 (fonctionnelle, horloge réelle)** : les 8 points de §10 par clics sur les `data-action`,
  saisie clavier, rechargement ; lecture dans le DOM (et l'état `S` pour les valeurs brutes des sondes).
- **Comparaison A/B** : signature par cas (compteurs : tuiles, lignes de tableau, onglets, prises, KPI, journal,
  activité…, et libellés/nombres des titres, KPI, en-têtes, boutons, lignes, tuiles, paramètres, journal…),
  valeurs `data-live`/`data-state` masquées, `HH:MM:SS`, « il y a … » et numéros de version normalisés.
  Chaque divergence est listée avec sa route et ses deux valeurs.

## 1. Commandes exécutées

```
cd /mnt/c/Users/Timothée/Documents/IA/Hermes/FermentationLab2/_verify
node.exe verifie.mjs --a http://127.0.0.1:8811/_verify/reference-original.html --cible a --sortie sortie-a > run-a-1.log 2>&1        # itération 1
node.exe verifie.mjs --a http://127.0.0.1:8811/_verify/reference-original.html --cible a --sortie sortie-a > run-a-2.log 2>&1        # itération 2
node.exe verifie.mjs --a http://127.0.0.1:8811/_verify/reference-original.html --cible a --sortie sortie-a > run-a-3.log 2>&1        # itération 3
node.exe verifie.mjs --a http://127.0.0.1:8811/_verify/reference-original.html --cible a --sortie sortie-a > run-a-final.log 2>&1    # finale A
node.exe verifie.mjs --a http://127.0.0.1:8811/_verify/_casse.html --cible a --sortie sortie-casse > run-casse.log 2>&1             # négatif
node.exe verifie.mjs --a http://127.0.0.1:8811/_verify/reference-original.html --b http://127.0.0.1:8812/hakko-dashboard.html --cible deux --sortie sortie-deux > run-deux.log 2>&1
node.exe verifie.mjs --a http://127.0.0.1:8811/_verify/reference-original.html --b http://127.0.0.1:8811/_verify/_casse-b.html --cible deux --sortie sortie-casse-b > run-casse-b.log 2>&1   # négatif A/B
```

## 2. Développement sur A — itérations et arbitrage des échecs

### Itération 1 (`run-a-1.log`) — code de sortie 1
```
=== RÉSUMÉ ===
{"duree_s":58,"assertions":170,"reussies":159,"echecs":11,"parPoint":{"§10.1":"33/33","§3.1":"32/32","§10.2":"24/24","§9":"26/36","§10.3":"6/6","§6.2":"7/7","§10.4":"10/10","§10.5":"5/5","§10.7":"11/11","§6.6":"1/1","§10.6":"4/4","harnais":"0/1"},"cibles":{"a":"testée"},"divergences":"non comparé"}

11 ÉCHEC(S) :
  ÉCHEC [a] §9 #/ 1440x860 clair débordements enfant→conteneur — attendu: 0 | obtenu: [{"el":"div.kpis.compact > div.card.kpi > div.v.num > span","px":2,"cote":"haut"}]
  ÉCHEC [a] §9 #/f/b1 1440x860 clair débordements enfant→conteneur — attendu: 0 | obtenu: [{"el":"div.kpis.compact > div.card.kpi > div.v.num > span","px":2,"cote":"haut"},{"el":"div.kpis.compact > div.card.kpi > div.v.num > span","px":2,"cote":"haut"}]
  ÉCHEC [a] §9 #/ 1440x860 sombre débordements enfant→conteneur — attendu: 0 | obtenu: [{"el":"div.kpis.compact > div.card.kpi > div.v.num > span","px":2,"cote":"haut"}]
  ÉCHEC [a] §9 #/f/b1 1440x860 sombre débordements enfant→conteneur — attendu: 0 | obtenu: [{"el":"div.kpis.compact > div.card.kpi > div.v.num > span","px":2,"cote":"haut"},{"el":"div.kpis.compact > div.card.kpi > div.v.num > span","px":2,"cote":"haut"}
  ÉCHEC [a] §9 #/ 1280x720 clair débordements enfant→conteneur — attendu: 0 | obtenu: [{"el":"div.kpis.compact > div.card.kpi > div.v.num > span","px":2,"cote":"haut"}]
  ÉCHEC [a] §9 #/f/b1 1280x720 clair débordements enfant→conteneur — attendu: 0 | obtenu: [{"el":"div.kpis.compact > div.card.kpi > div.v.num > span","px":2,"cote":"haut"},{"el":"div.kpis.compact > div.card.kpi > div.v.num > span","px":2,"cote":"haut"}]
  ÉCHEC [a] §9 #/archive/b0 1280x720 clair débordements enfant→conteneur — attendu: 0 | obtenu: [{"el":"div.dp-chart-body > div.dp-plot > div#arch-2.chart.fill > svg","px":18.4,"cote":"bas"}]
  ÉCHEC [a] §9 #/ 1280x720 sombre débordements enfant→conteneur — attendu: 0 | obtenu: [{"el":"div.kpis.compact > div.card.kpi > div.v.num > span","px":2,"cote":"haut"}]
  ÉCHEC [a] §9 #/f/b1 1280x720 sombre débordements enfant→conteneur — attendu: 0 | obtenu: [{"el":"div.kpis.compact > div.card.kpi > div.v.num > span","px":2,"cote":"haut"},{"el":"div.kpis.compact > div.card.kpi > div.v.num > span","px":2,"cote":"haut"}
  ÉCHEC [a] §9 #/archive/b0 1280x720 sombre débordements enfant→conteneur — attendu: 0 | obtenu: [{"el":"div.dp-chart-body > div.dp-plot > div#arch-2.chart.fill > svg","px":18.4,"cote":"bas"}]
  ÉCHEC [a] harnais passe fonctionnelle sans exception — attendu: "pas d’exception" | obtenu: "TimeoutError: Waiting failed: 5000ms exceeded\n    at new WaitTask (file:///C:/Users/Timoth%C3%A9e/Documents/IA/Hermes/FermentationLab2/_verify/node_modules/pup
```

Arbitrage :
- `div.kpis.compact > div.card.kpi > div.v.num > span` dépasse de 2 px en haut : **défaut du harnais**. Le rect
  d'un `span` inline est la zone de contenu de la police, plus haute que la boîte de ligne de `.v`
  (interligne serré) ; ce n'est pas un débordement de mise en page. Correction : dépassement vertical ignoré
  pour `display:inline`.
- `TimeoutError … at aller` : **défaut du harnais**. Pour vérifier la redirection `#/f/b4` → `#/archive/b4`,
  le harnais attendait `location.hash === '#/f/b4'`, alors que l'application (§2) remplace immédiatement le hash.
  Correction : attendre `#/archive/b4`.
- `#arch-2 … svg` 18,4 px en bas (1280×720) : voir itération suivante (échec conservé).

### Itération 2 (`run-a-2.log`) — code de sortie 1
```
=== RÉSUMÉ ===
{"duree_s":62,"assertions":181,"reussies":178,"echecs":3,"parPoint":{"§10.1":"33/33","§3.1":"32/32","§10.2":"24/24","§9":"34/36","§10.3":"5/6","§6.2":"7/7","§10.4":"10/10","§10.5":"5/5","§10.7":"11/11","§6.6":"1/1","§10.6":"4/4","§2":"1/1","§4":"1/1","§1":"1/1","§10.8":"9/9"},"cibles":{"a":"testée"},"divergences":"non comparé"}

3 ÉCHEC(S) :
 - [a] §9 #/archive/b0 1280x720 clair débordements enfant→conteneur
     attendu: 0
     obtenu : [{"el":"div.dp-chart-body > div.dp-plot > div#arch-2.chart.fill > svg","px":18.4,"cote":"bas"}]
 - [a] §9 #/archive/b0 1280x720 sombre débordements enfant→conteneur
     attendu: 0
     obtenu : [{"el":"div.dp-chart-body > div.dp-plot > div#arch-2.chart.fill > svg","px":18.4,"cote":"bas"}]
 - [a] §10.3 #/f/b1 : au moins une valeur data-live a changé
     attendu: "≥ 1"
     obtenu : {"changees":0,"total":5,"exemples":[]}
Rapport JSON : C:\Users\Timothée\Documents\IA\Hermes\FermentationLab2\_verify\sortie-a\rapport.json
```

Arbitrage :
- `§10.3 #/f/b1 : au moins une valeur data-live a changé` (0/5) : **défaut du harnais**. Une sonde de contrôle
  (5 ticks, `#/f/b1`) montre que l'état change à chaque tick mais que l'affichage arrondi peut se répéter :
  `dev:t1=23,86 °C` à 09:03:18 puis `dev:t1=23,86 °C` à 09:03:21 (`S.t1=23.8574…` → `23.8642…`).
  Sortie brute de la sonde (script jetable `_sonde-live.mjs`, supprimé ensuite) :
  ```
  ["En direct, 09:03:09","temp:b1=23,8","delta:b1=−0,2 °C vs cible","heat:b1=Veille","dev:t1=23,85 °C","dev:p1=0 W","S.t1=23.846404512260936"]
  ["En direct, 09:03:12","temp:b1=23,8","delta:b1=−0,2 °C vs cible","heat:b1=Veille","dev:t1=23,84 °C","dev:p1=0 W","S.t1=23.843103239431716"]
  ["En direct, 09:03:15","temp:b1=23,8","delta:b1=−0,2 °C vs cible","heat:b1=Veille","dev:t1=23,83 °C","dev:p1=0 W","S.t1=23.82954604672967"]
  ["En direct, 09:03:18","temp:b1=23,9","delta:b1=−0,1 °C vs cible","heat:b1=Veille","dev:t1=23,86 °C","dev:p1=0 W","S.t1=23.85749284381633"]
  ["En direct, 09:03:21","temp:b1=23,9","delta:b1=−0,1 °C vs cible","heat:b1=Veille","dev:t1=23,86 °C","dev:p1=0 W","S.t1=23.864293273471073"]
  ```
  Deux ticks ne suffisent donc pas à garantir un changement visible à 1–2 décimales. Correction : à chaque tick
  on exige que l'horloge **et** les valeurs brutes des sondes (état JS) changent, et on observe le DOM jusqu'à
  5 ticks en exigeant au moins une valeur `data-live` affichée différente ; focus et scroll sont vérifiés
  à la fin de toute la fenêtre.
- `§9 #/archive/b0 1280x720 débordements enfant→conteneur` (`#arch-2 > svg`, 18,4 px) : **défaut de l'application**
  (présent dans la référence). La capture `sortie-a/a_1280x720_clair_archive_b0.png` montre les étiquettes
  d'axe « J1 … J6 » du graphique Densité qui chevauchent la légende « Relevés / Densité visée ».
  Cause : `drawChart` impose une hauteur minimale de 120 px (`H = fill ? Math.max(120, el.clientHeight) …`,
  Annexe C / §8) alors qu'à 1280×720 la cellule `.arch-2` est plus petite, et `.dp-grid.arch .arch-2{overflow:visible}`
  laisse le SVG déborder. Règle concernée : §10.2 « la Fiche d'archive **tient** sans scroll en 1280 × 720 »
  et §9 (contenu interne en flex/grid avec `min-height:0`) — la page ne défile pas (lettre respectée) mais le contenu
  ne tient pas dans sa cellule. L'échec est **conservé** : c'est une mesure réelle, pas un artefact.

### Exécution finale sur A (`run-a-final.log`) — code de sortie 1, sortie intégrale
```
[a] http://127.0.0.1:8811/_verify/reference-original.html — passe mise en page (8 routes × 2 thèmes × 2 viewports)
................................
  OK  [a] §10.1 #/ 1440x860 clair erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/ 1440x860 clair thème appliqué (--bg) — attendu: "#F4F5F7" | obtenu: "#F4F5F7"
  OK  [a] §10.2 #/ 1440x860 clair défilement vertical du document — attendu: 0 | obtenu: 0
  OK  [a] §10.2 #/ 1440x860 clair défilement horizontal du document — attendu: 0 | obtenu: 0
  OK  [a] §9 #/ 1440x860 clair data-page="detail" — attendu: "detail" | obtenu: "detail"
  OK  [a] §9 #/ 1440x860 clair éléments hors écran hors conteneur défilant — attendu: 0 | obtenu: 0
  OK  [a] §9 #/ 1440x860 clair débordements enfant→conteneur — attendu: 0 | obtenu: 0
  OK  [a] §10.1 #/f/b1 1440x860 clair erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/f/b1 1440x860 clair thème appliqué (--bg) — attendu: "#F4F5F7" | obtenu: "#F4F5F7"
  OK  [a] §10.2 #/f/b1 1440x860 clair défilement vertical du document — attendu: 0 | obtenu: 0
  OK  [a] §10.2 #/f/b1 1440x860 clair défilement horizontal du document — attendu: 0 | obtenu: 0
  OK  [a] §9 #/f/b1 1440x860 clair data-page="detail" — attendu: "detail" | obtenu: "detail"
  OK  [a] §9 #/f/b1 1440x860 clair éléments hors écran hors conteneur défilant — attendu: 0 | obtenu: 0
  OK  [a] §9 #/f/b1 1440x860 clair débordements enfant→conteneur — attendu: 0 | obtenu: 0
  OK  [a] §10.1 #/archive 1440x860 clair erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/archive 1440x860 clair thème appliqué (--bg) — attendu: "#F4F5F7" | obtenu: "#F4F5F7"
  OK  [a] §10.1 #/archive/b0 1440x860 clair erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/archive/b0 1440x860 clair thème appliqué (--bg) — attendu: "#F4F5F7" | obtenu: "#F4F5F7"
  OK  [a] §10.2 #/archive/b0 1440x860 clair défilement vertical du document — attendu: 0 | obtenu: 0
  OK  [a] §10.2 #/archive/b0 1440x860 clair défilement horizontal du document — attendu: 0 | obtenu: 0
  OK  [a] §9 #/archive/b0 1440x860 clair data-page="detail" — attendu: "detail" | obtenu: "detail"
  OK  [a] §9 #/archive/b0 1440x860 clair éléments hors écran hors conteneur défilant — attendu: 0 | obtenu: 0
  OK  [a] §9 #/archive/b0 1440x860 clair débordements enfant→conteneur — attendu: 0 | obtenu: 0
  OK  [a] §10.1 #/recettes 1440x860 clair erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/recettes 1440x860 clair thème appliqué (--bg) — attendu: "#F4F5F7" | obtenu: "#F4F5F7"
  OK  [a] §10.1 #/recettes/new 1440x860 clair erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/recettes/new 1440x860 clair thème appliqué (--bg) — attendu: "#F4F5F7" | obtenu: "#F4F5F7"
  OK  [a] §10.1 #/recettes/r1 1440x860 clair erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/recettes/r1 1440x860 clair thème appliqué (--bg) — attendu: "#F4F5F7" | obtenu: "#F4F5F7"
  OK  [a] §10.1 #/appareils 1440x860 clair erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/appareils 1440x860 clair thème appliqué (--bg) — attendu: "#F4F5F7" | obtenu: "#F4F5F7"
  OK  [a] §10.1 #/ 1440x860 sombre erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/ 1440x860 sombre thème appliqué (--bg) — attendu: "#0E1116" | obtenu: "#0E1116"
  OK  [a] §10.2 #/ 1440x860 sombre défilement vertical du document — attendu: 0 | obtenu: 0
  OK  [a] §10.2 #/ 1440x860 sombre défilement horizontal du document — attendu: 0 | obtenu: 0
  OK  [a] §9 #/ 1440x860 sombre data-page="detail" — attendu: "detail" | obtenu: "detail"
  OK  [a] §9 #/ 1440x860 sombre éléments hors écran hors conteneur défilant — attendu: 0 | obtenu: 0
  OK  [a] §9 #/ 1440x860 sombre débordements enfant→conteneur — attendu: 0 | obtenu: 0
  OK  [a] §10.1 #/f/b1 1440x860 sombre erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/f/b1 1440x860 sombre thème appliqué (--bg) — attendu: "#0E1116" | obtenu: "#0E1116"
  OK  [a] §10.2 #/f/b1 1440x860 sombre défilement vertical du document — attendu: 0 | obtenu: 0
  OK  [a] §10.2 #/f/b1 1440x860 sombre défilement horizontal du document — attendu: 0 | obtenu: 0
  OK  [a] §9 #/f/b1 1440x860 sombre data-page="detail" — attendu: "detail" | obtenu: "detail"
  OK  [a] §9 #/f/b1 1440x860 sombre éléments hors écran hors conteneur défilant — attendu: 0 | obtenu: 0
  OK  [a] §9 #/f/b1 1440x860 sombre débordements enfant→conteneur — attendu: 0 | obtenu: 0
  OK  [a] §10.1 #/archive 1440x860 sombre erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/archive 1440x860 sombre thème appliqué (--bg) — attendu: "#0E1116" | obtenu: "#0E1116"
  OK  [a] §10.1 #/archive/b0 1440x860 sombre erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/archive/b0 1440x860 sombre thème appliqué (--bg) — attendu: "#0E1116" | obtenu: "#0E1116"
  OK  [a] §10.2 #/archive/b0 1440x860 sombre défilement vertical du document — attendu: 0 | obtenu: 0
  OK  [a] §10.2 #/archive/b0 1440x860 sombre défilement horizontal du document — attendu: 0 | obtenu: 0
  OK  [a] §9 #/archive/b0 1440x860 sombre data-page="detail" — attendu: "detail" | obtenu: "detail"
  OK  [a] §9 #/archive/b0 1440x860 sombre éléments hors écran hors conteneur défilant — attendu: 0 | obtenu: 0
  OK  [a] §9 #/archive/b0 1440x860 sombre débordements enfant→conteneur — attendu: 0 | obtenu: 0
  OK  [a] §10.1 #/recettes 1440x860 sombre erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/recettes 1440x860 sombre thème appliqué (--bg) — attendu: "#0E1116" | obtenu: "#0E1116"
  OK  [a] §10.1 #/recettes/new 1440x860 sombre erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/recettes/new 1440x860 sombre thème appliqué (--bg) — attendu: "#0E1116" | obtenu: "#0E1116"
  OK  [a] §10.1 #/recettes/r1 1440x860 sombre erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/recettes/r1 1440x860 sombre thème appliqué (--bg) — attendu: "#0E1116" | obtenu: "#0E1116"
  OK  [a] §10.1 #/appareils 1440x860 sombre erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/appareils 1440x860 sombre thème appliqué (--bg) — attendu: "#0E1116" | obtenu: "#0E1116"
  OK  [a] §10.1 #/ 1280x720 clair erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/ 1280x720 clair thème appliqué (--bg) — attendu: "#F4F5F7" | obtenu: "#F4F5F7"
  OK  [a] §10.2 #/ 1280x720 clair défilement vertical du document — attendu: 0 | obtenu: 0
  OK  [a] §10.2 #/ 1280x720 clair défilement horizontal du document — attendu: 0 | obtenu: 0
  OK  [a] §9 #/ 1280x720 clair data-page="detail" — attendu: "detail" | obtenu: "detail"
  OK  [a] §9 #/ 1280x720 clair éléments hors écran hors conteneur défilant — attendu: 0 | obtenu: 0
  OK  [a] §9 #/ 1280x720 clair débordements enfant→conteneur — attendu: 0 | obtenu: 0
  OK  [a] §10.1 #/f/b1 1280x720 clair erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/f/b1 1280x720 clair thème appliqué (--bg) — attendu: "#F4F5F7" | obtenu: "#F4F5F7"
  OK  [a] §10.2 #/f/b1 1280x720 clair défilement vertical du document — attendu: 0 | obtenu: 0
  OK  [a] §10.2 #/f/b1 1280x720 clair défilement horizontal du document — attendu: 0 | obtenu: 0
  OK  [a] §9 #/f/b1 1280x720 clair data-page="detail" — attendu: "detail" | obtenu: "detail"
  OK  [a] §9 #/f/b1 1280x720 clair éléments hors écran hors conteneur défilant — attendu: 0 | obtenu: 0
  OK  [a] §9 #/f/b1 1280x720 clair débordements enfant→conteneur — attendu: 0 | obtenu: 0
  OK  [a] §10.1 #/archive 1280x720 clair erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/archive 1280x720 clair thème appliqué (--bg) — attendu: "#F4F5F7" | obtenu: "#F4F5F7"
  OK  [a] §10.1 #/archive/b0 1280x720 clair erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/archive/b0 1280x720 clair thème appliqué (--bg) — attendu: "#F4F5F7" | obtenu: "#F4F5F7"
  OK  [a] §10.2 #/archive/b0 1280x720 clair défilement vertical du document — attendu: 0 | obtenu: 0
  OK  [a] §10.2 #/archive/b0 1280x720 clair défilement horizontal du document — attendu: 0 | obtenu: 0
  OK  [a] §9 #/archive/b0 1280x720 clair data-page="detail" — attendu: "detail" | obtenu: "detail"
  OK  [a] §9 #/archive/b0 1280x720 clair éléments hors écran hors conteneur défilant — attendu: 0 | obtenu: 0
  ÉCHEC [a] §9 #/archive/b0 1280x720 clair débordements enfant→conteneur — attendu: 0 | obtenu: [{"el":"div.dp-chart-body > div.dp-plot > div#arch-2.chart.fill > svg","px":18.4,"cote":"bas"}]
  OK  [a] §10.1 #/recettes 1280x720 clair erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/recettes 1280x720 clair thème appliqué (--bg) — attendu: "#F4F5F7" | obtenu: "#F4F5F7"
  OK  [a] §10.1 #/recettes/new 1280x720 clair erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/recettes/new 1280x720 clair thème appliqué (--bg) — attendu: "#F4F5F7" | obtenu: "#F4F5F7"
  OK  [a] §10.1 #/recettes/r1 1280x720 clair erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/recettes/r1 1280x720 clair thème appliqué (--bg) — attendu: "#F4F5F7" | obtenu: "#F4F5F7"
  OK  [a] §10.1 #/appareils 1280x720 clair erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/appareils 1280x720 clair thème appliqué (--bg) — attendu: "#F4F5F7" | obtenu: "#F4F5F7"
  OK  [a] §10.1 #/ 1280x720 sombre erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/ 1280x720 sombre thème appliqué (--bg) — attendu: "#0E1116" | obtenu: "#0E1116"
  OK  [a] §10.2 #/ 1280x720 sombre défilement vertical du document — attendu: 0 | obtenu: 0
  OK  [a] §10.2 #/ 1280x720 sombre défilement horizontal du document — attendu: 0 | obtenu: 0
  OK  [a] §9 #/ 1280x720 sombre data-page="detail" — attendu: "detail" | obtenu: "detail"
  OK  [a] §9 #/ 1280x720 sombre éléments hors écran hors conteneur défilant — attendu: 0 | obtenu: 0
  OK  [a] §9 #/ 1280x720 sombre débordements enfant→conteneur — attendu: 0 | obtenu: 0
  OK  [a] §10.1 #/f/b1 1280x720 sombre erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/f/b1 1280x720 sombre thème appliqué (--bg) — attendu: "#0E1116" | obtenu: "#0E1116"
  OK  [a] §10.2 #/f/b1 1280x720 sombre défilement vertical du document — attendu: 0 | obtenu: 0
  OK  [a] §10.2 #/f/b1 1280x720 sombre défilement horizontal du document — attendu: 0 | obtenu: 0
  OK  [a] §9 #/f/b1 1280x720 sombre data-page="detail" — attendu: "detail" | obtenu: "detail"
  OK  [a] §9 #/f/b1 1280x720 sombre éléments hors écran hors conteneur défilant — attendu: 0 | obtenu: 0
  OK  [a] §9 #/f/b1 1280x720 sombre débordements enfant→conteneur — attendu: 0 | obtenu: 0
  OK  [a] §10.1 #/archive 1280x720 sombre erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/archive 1280x720 sombre thème appliqué (--bg) — attendu: "#0E1116" | obtenu: "#0E1116"
  OK  [a] §10.1 #/archive/b0 1280x720 sombre erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/archive/b0 1280x720 sombre thème appliqué (--bg) — attendu: "#0E1116" | obtenu: "#0E1116"
  OK  [a] §10.2 #/archive/b0 1280x720 sombre défilement vertical du document — attendu: 0 | obtenu: 0
  OK  [a] §10.2 #/archive/b0 1280x720 sombre défilement horizontal du document — attendu: 0 | obtenu: 0
  OK  [a] §9 #/archive/b0 1280x720 sombre data-page="detail" — attendu: "detail" | obtenu: "detail"
  OK  [a] §9 #/archive/b0 1280x720 sombre éléments hors écran hors conteneur défilant — attendu: 0 | obtenu: 0
  ÉCHEC [a] §9 #/archive/b0 1280x720 sombre débordements enfant→conteneur — attendu: 0 | obtenu: [{"el":"div.dp-chart-body > div.dp-plot > div#arch-2.chart.fill > svg","px":18.4,"cote":"bas"}]
  OK  [a] §10.1 #/recettes 1280x720 sombre erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/recettes 1280x720 sombre thème appliqué (--bg) — attendu: "#0E1116" | obtenu: "#0E1116"
  OK  [a] §10.1 #/recettes/new 1280x720 sombre erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/recettes/new 1280x720 sombre thème appliqué (--bg) — attendu: "#0E1116" | obtenu: "#0E1116"
  OK  [a] §10.1 #/recettes/r1 1280x720 sombre erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/recettes/r1 1280x720 sombre thème appliqué (--bg) — attendu: "#0E1116" | obtenu: "#0E1116"
  OK  [a] §10.1 #/appareils 1280x720 sombre erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0
  OK  [a] §3.1 #/appareils 1280x720 sombre thème appliqué (--bg) — attendu: "#0E1116" | obtenu: "#0E1116"
[a] passe fonctionnelle (§10)
  OK  [a] §10.3 accueil : à chaque tick l’horloge « En direct » et les valeurs brutes des sondes (état JS) changent — attendu: "✓/✓ ✓/✓" | obtenu: "✓/✓ ✓/✓"
  OK  [a] §10.3 accueil : au moins une valeur data-live affichée a changé (en 2 ticks) — attendu: "≥ 1" | obtenu: {"changees":2,"total":15,"exemples":["dev:t2#12: 20,50 °C → 20,54 °C","dev:t1#14: 23,87 °C → 23,86 °C"]}
  OK  [a] §10.3 accueil : #feed défilable et scrollTop conservé — attendu: {"defilable":true,"top":80,"memeNoeud":true} | obtenu: {"defilable":true,"top":80,"memeNoeud":true}
  OK  [a] §10.3 #/f/b1 : à chaque tick l’horloge et les valeurs brutes des sondes (état JS) changent — attendu: "✓/✓ ✓/✓" | obtenu: "✓/✓ ✓/✓"
  OK  [a] §10.3 #/f/b1 : au moins une valeur data-live affichée a changé (en 2 ticks) — attendu: "≥ 1" | obtenu: {"changees":3,"total":5,"exemples":["temp:b1#0: 23,9 → 23,8","delta:b1#1: −0,1 °C vs cible → −0,2 °C vs cible","dev:t1#3: 23,86 °C → 23,85 °C"]}
  OK  [a] §10.3 #/f/b1 : focus conservé dans le champ note — attendu: {"focus":true,"valeur":"Observation en cours"} | obtenu: {"focus":true,"valeur":"Observation en cours"}
  OK  [a] §10.3 #/f/b1 : journal défilable et scrollTop conservé — attendu: {"defilable":true,"top":50} | obtenu: {"defilable":true,"top":50}
  OK  [a] §6.2 stepper : 6 clics + depuis 24 — attendu: 27 | obtenu: 27
  OK  [a] §10.4 consigne 24,0→27,0 : entrée « Consigne » — attendu: "Consigne modifiée de 24,0 °C à 27,0 °C" | obtenu: "Consigne modifiée de 24,0 °C à 27,0 °C"
  OK  [a] §10.4 consigne 24,0→27,0 : une nouvelle entrée de chauffe — attendu: 11 | obtenu: 11
  OK  [a] §10.4 consigne 24,0→27,0 : entrée de chauffe la plus récente au format et au sens attendus — attendu: "x °C (−y °C) - Activation de la chauffe [badge Chauffe on]" | obtenu: "23,9 °C (−3,1 °C) - Activation de la chauffe [badge Chauffe on]"
  OK  [a] §10.4 consigne 24,0→27,0 : tp − écart = nouvelle consigne (±0,1) — attendu: 27 | obtenu: 27
  OK  [a] §10.4 consigne 24,0→27,0 : « Consigne » puis chauffe (chauffe plus récente ou simultanée) — attendu: "index chauffe < index consigne" | obtenu: {"iChauffe":0,"iConsigne":1}
  OK  [a] §6.2 KPI Consigne après application — attendu: "27,0°C" | obtenu: "27,0°C"
  OK  [a] §6.2 stepper : 12 clics − depuis 27 — attendu: 21 | obtenu: 21
  OK  [a] §10.4 consigne 27,0→21,0 : entrée « Consigne » — attendu: "Consigne modifiée de 27,0 °C à 21,0 °C" | obtenu: "Consigne modifiée de 27,0 °C à 21,0 °C"
  OK  [a] §10.4 consigne 27,0→21,0 : une nouvelle entrée de chauffe — attendu: 12 | obtenu: 12
  OK  [a] §10.4 consigne 27,0→21,0 : entrée de chauffe la plus récente au format et au sens attendus — attendu: "x °C (+y °C) - Désactivation de la chauffe [badge Chauffe off]" | obtenu: "23,9 °C (+2,9 °C) - Désactivation de la chauffe [badge Chauffe off]"
  OK  [a] §10.4 consigne 27,0→21,0 : tp − écart = nouvelle consigne (±0,1) — attendu: 21 | obtenu: 21
  OK  [a] §10.4 consigne 27,0→21,0 : « Consigne » puis chauffe (chauffe plus récente ou simultanée) — attendu: "index chauffe < index consigne" | obtenu: {"iChauffe":0,"iConsigne":1}
  OK  [a] §6.2 KPI Consigne après application — attendu: "21,0°C" | obtenu: "21,0°C"
  OK  [a] §6.2 onglet Densité : période masquée — attendu: true | obtenu: true
  OK  [a] §6.2 saisie du relevé — attendu: {"g":"1.007","d":"datetime-local non vide"} | obtenu: {"g":"1.007","d":"2026-09-18T01:53"}
  OK  [a] §10.5 tableau : une ligne de plus — attendu: 7 | obtenu: 7
  OK  [a] §10.5 tableau : ligne 1,007 à la date saisie — attendu: "18 sept., 01:53" | obtenu: "18 sept., 01:53"
  OK  [a] §10.5 tableau : ligne 1,007 triée à sa place (du plus récent au plus ancien) — attendu: 3 | obtenu: 3
  OK  [a] §10.5 graphique : un point de plus — attendu: 7 | obtenu: 7
  OK  [a] §10.5 graphique : point 1,007 (le plus bas) à l’abscisse de sa date — attendu: "cx ≈ 159.0 (rang 3)" | obtenu: "cx = 159.0050773184891 (rang 3)"
  OK  [a] §10.7 nombre de tuiles de prise — attendu: 5 | obtenu: 5
  OK  [a] §10.7 Prise 1 : ON vert ou OFF rouge (44 px, texte blanc) — attendu: "ON/rgb(31, 157, 85) ou OFF/rgb(197, 48, 48)" | obtenu: "OFF/rgb(197, 48, 48)/44px/rgb(255, 255, 255)"
  OK  [a] §10.7 Prise 2 : ON vert ou OFF rouge (44 px, texte blanc) — attendu: "ON/rgb(31, 157, 85) ou OFF/rgb(197, 48, 48)" | obtenu: "OFF/rgb(197, 48, 48)/44px/rgb(255, 255, 255)"
  OK  [a] §10.7 Prise 3 : ON vert ou OFF rouge (44 px, texte blanc) — attendu: "ON/rgb(31, 157, 85) ou OFF/rgb(197, 48, 48)" | obtenu: "OFF/rgb(197, 48, 48)/44px/rgb(255, 255, 255)"
  OK  [a] §10.7 Prise 4 : ON vert ou OFF rouge (44 px, texte blanc) — attendu: "ON/rgb(31, 157, 85) ou OFF/rgb(197, 48, 48)" | obtenu: "OFF/rgb(197, 48, 48)/44px/rgb(255, 255, 255)"
  OK  [a] §10.7 Prise 5 : ON vert ou OFF rouge (44 px, texte blanc) — attendu: "ON/rgb(31, 157, 85) ou OFF/rgb(197, 48, 48)" | obtenu: "OFF/rgb(197, 48, 48)/44px/rgb(255, 255, 255)"
  OK  [a] §10.7 Prise 1 : bascule au clic — attendu: "ON/rgb(31, 157, 85)" | obtenu: "ON/rgb(31, 157, 85)"
  OK  [a] §10.7 Prise 2 : bascule au clic — attendu: "ON/rgb(31, 157, 85)" | obtenu: "ON/rgb(31, 157, 85)"
  OK  [a] §10.7 Prise 3 : bascule au clic — attendu: "ON/rgb(31, 157, 85)" | obtenu: "ON/rgb(31, 157, 85)"
  OK  [a] §10.7 Prise 4 : bascule au clic — attendu: "ON/rgb(31, 157, 85)" | obtenu: "ON/rgb(31, 157, 85)"
  OK  [a] §10.7 Prise 5 : bascule au clic — attendu: "ON/rgb(31, 157, 85)" | obtenu: "ON/rgb(31, 157, 85)"
  OK  [a] §6.6 prises basculées (mode manuel) stables après un tick — attendu: "ON ON ON ON ON" | obtenu: "ON ON ON ON ON"
  OK  [a] §6.2 confirmation « Terminer le lot » — attendu: "Terminer ce lot ? Il sera déplacé dans l’Archive et les appareils reliés seront libérés." | obtenu: "Terminer ce lot ? Il sera déplacé dans l’Archive et les appareils reliés seront libérés."
  OK  [a] §10.6 ouvre la fiche d’archive — attendu: "#/archive/b4" | obtenu: "#/archive/b4"
  OK  [a] §10.6 fiche : titre et badge « Archivé » — attendu: {"h1":"Garum de champignons","badge":"Archivé"} | obtenu: {"h1":"Garum de champignons","badge":"Archivé"}
  OK  [a] §10.6 fiche en lecture seule (aucun bouton, formulaire ni champ) — attendu: 0 | obtenu: 0
  OK  [a] §10.6 le lot disparaît de l’accueil — attendu: {"tuiles":3,"sansB4":true,"kpiLots":"3"} | obtenu: {"tuiles":3,"sansB4":true,"kpiLots":"3"}
  OK  [a] §2 #/f/b4 terminé redirige vers #/archive/b4 — attendu: "#/archive/b4" | obtenu: "#/archive/b4"
  OK  [a] §4 bouton de thème : 2 clics auto→light→dark — attendu: {"attr":"dark","cle":"dark","bg":"#0E1116"} | obtenu: {"attr":"dark","cle":"dark","bg":"#0E1116"}
  OK  [a] §1 localStorage « hakko-dashboard-v1 » lisible et à jour — attendu: {"b4":"done"} | obtenu: {"lots":5,"b4":"done"}
  OK  [a] §10.8 après rechargement : tuiles — attendu: "#/f/b2 #/f/b1 #/f/b3" | obtenu: "#/f/b2 #/f/b1 #/f/b3"
  OK  [a] §10.8 après rechargement : theme — attendu: "dark" | obtenu: "dark"
  OK  [a] §10.8 après rechargement : consigne — attendu: "Actuelle 21,0 °C" | obtenu: "Actuelle 21,0 °C"
  OK  [a] §10.8 après rechargement : entreesConsigne — attendu: "Consigne modifiée de 27,0 °C à 21,0 °C | Consigne modifiée de 24,0 °C à 27,0 °C" | obtenu: "Consigne modifiée de 27,0 °C à 21,0 °C | Consigne modifiée de 24,0 °C à 27,0 °C"
  OK  [a] §10.8 après rechargement : releves — attendu: "1,008 1,010 1,016 1,007 1,030 1,047 1,058" | obtenu: "1,008 1,010 1,016 1,007 1,030 1,047 1,058"
  OK  [a] §10.8 après rechargement : prises — attendu: "ON ON OFF ON ON" | obtenu: "ON ON OFF ON ON"
  OK  [a] §10.8 après rechargement : archive — attendu: "#/archive/b4 #/archive/b0" | obtenu: "#/archive/b4 #/archive/b0"
  OK  [a] §10.8 après rechargement : consigne modifiée conservée — attendu: "Actuelle 21,0 °C" | obtenu: "Actuelle 21,0 °C"
  OK  [a] §10.8 après rechargement : relevé 1,007 conservé — attendu: "contient 1,007" | obtenu: "1,008 1,010 1,016 1,007 1,030 1,047 1,058"
  OK  [a] §10.1 passe fonctionnelle : erreurs console/pageerror/HTTP≥400/requêtes échouées — attendu: 0 | obtenu: 0

[a] route              vp        thème   défil.V défil.H débord. hors-écran erreurs capture
[a] #/                 1440x860  clair         0       0       0          0       0 a_1440x860_clair_accueil.png
[a] #/f/b1             1440x860  clair         0       0       0          0       0 a_1440x860_clair_f_b1.png
[a] #/archive          1440x860  clair         0       0       0          0       0 a_1440x860_clair_archive.png
[a] #/archive/b0       1440x860  clair         0       0       0          0       0 a_1440x860_clair_archive_b0.png
[a] #/recettes         1440x860  clair         0       0       0          0       0 a_1440x860_clair_recettes.png
[a] #/recettes/new     1440x860  clair       684       0       0         54       0 a_1440x860_clair_recettes_new.png
[a] #/recettes/r1      1440x860  clair       949       0       0         79       0 a_1440x860_clair_recettes_r1.png
[a] #/appareils        1440x860  clair       335       0       0          5       0 a_1440x860_clair_appareils.png
[a] #/                 1440x860  sombre        0       0       0          0       0 a_1440x860_sombre_accueil.png
[a] #/f/b1             1440x860  sombre        0       0       0          0       0 a_1440x860_sombre_f_b1.png
[a] #/archive          1440x860  sombre        0       0       0          0       0 a_1440x860_sombre_archive.png
[a] #/archive/b0       1440x860  sombre        0       0       0          0       0 a_1440x860_sombre_archive_b0.png
[a] #/recettes         1440x860  sombre        0       0       0          0       0 a_1440x860_sombre_recettes.png
[a] #/recettes/new     1440x860  sombre      684       0       0         54       0 a_1440x860_sombre_recettes_new.png
[a] #/recettes/r1      1440x860  sombre      949       0       0         79       0 a_1440x860_sombre_recettes_r1.png
[a] #/appareils        1440x860  sombre      335       0       0          5       0 a_1440x860_sombre_appareils.png
[a] #/                 1280x720  clair         0       0       0          0       0 a_1280x720_clair_accueil.png
[a] #/f/b1             1280x720  clair         0       0       0          0       0 a_1280x720_clair_f_b1.png
[a] #/archive          1280x720  clair         0       0       0          0       0 a_1280x720_clair_archive.png
[a] #/archive/b0       1280x720  clair         0       0       1          0       0 a_1280x720_clair_archive_b0.png
[a] #/recettes         1280x720  clair         0       0       0          0       0 a_1280x720_clair_recettes.png
[a] #/recettes/new     1280x720  clair       824       0       0         66       0 a_1280x720_clair_recettes_new.png
[a] #/recettes/r1      1280x720  clair      1089       0       0         91       0 a_1280x720_clair_recettes_r1.png
[a] #/appareils        1280x720  clair       789       0       0          5       0 a_1280x720_clair_appareils.png
[a] #/                 1280x720  sombre        0       0       0          0       0 a_1280x720_sombre_accueil.png
[a] #/f/b1             1280x720  sombre        0       0       0          0       0 a_1280x720_sombre_f_b1.png
[a] #/archive          1280x720  sombre        0       0       0          0       0 a_1280x720_sombre_archive.png
[a] #/archive/b0       1280x720  sombre        0       0       1          0       0 a_1280x720_sombre_archive_b0.png
[a] #/recettes         1280x720  sombre        0       0       0          0       0 a_1280x720_sombre_recettes.png
[a] #/recettes/new     1280x720  sombre      824       0       0         66       0 a_1280x720_sombre_recettes_new.png
[a] #/recettes/r1      1280x720  sombre     1089       0       0         91       0 a_1280x720_sombre_recettes_r1.png
[a] #/appareils        1280x720  sombre      789       0       0          5       0 a_1280x720_sombre_appareils.png

=== RÉSUMÉ ===
{"duree_s":62,"assertions":182,"reussies":180,"echecs":2,"parPoint":{"§10.1":"33/33","§3.1":"32/32","§10.2":"24/24","§9":"34/36","§10.3":"7/7","§6.2":"7/7","§10.4":"10/10","§10.5":"5/5","§10.7":"11/11","§6.6":"1/1","§10.6":"4/4","§2":"1/1","§4":"1/1","§1":"1/1","§10.8":"9/9"},"cibles":{"a":"testée"},"divergences":"non comparé"}

2 ÉCHEC(S) :
 - [a] §9 #/archive/b0 1280x720 clair débordements enfant→conteneur
     attendu: 0
     obtenu : [{"el":"div.dp-chart-body > div.dp-plot > div#arch-2.chart.fill > svg","px":18.4,"cote":"bas"}]
 - [a] §9 #/archive/b0 1280x720 sombre débordements enfant→conteneur
     attendu: 0
     obtenu : [{"el":"div.dp-chart-body > div.dp-plot > div#arch-2.chart.fill > svg","px":18.4,"cote":"bas"}]
Rapport JSON : C:\Users\Timothée\Documents\IA\Hermes\FermentationLab2\_verify\sortie-a\rapport.json
```

Bilan A : 182 assertions, 180 OK, 2 échecs = le débordement `#arch-2` de la fiche d'archive en 1280×720
(clair et sombre), **défaut de l'application de référence** (voir arbitrage ci-dessus).
Aucune erreur console, `pageerror`, HTTP ≥ 400 ni requête échouée sur les 32 cas + la passe fonctionnelle.
Défilement du document nul pour `#/`, `#/f/b1`, `#/archive/b0` aux deux viewports et dans les deux thèmes.
Les pages non « un seul écran » (`#/recettes/new`, `#/recettes/r1`, `#/appareils`) défilent normalement :
c'est mesuré et affiché, sans assertion (§9 ne l'interdit pas).

## 3. Assertion négative — le harnais passe au rouge

Copie jetable `_verify/_casse.html` de la référence, deux propriétés vérifiées cassées volontairement :
```
390c390
<   .dp{height:calc(100vh - 60px - 40px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));height:calc(100dvh - 60px - 40px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));min-height:600px;display:flex;flex-direction:column}
---
>   .dp{height:calc(100vh - 60px - 40px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));height:calc(100dvh - 60px - 40px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));min-height:900px;display:flex;flex-direction:column}
463c463
< .o-btn[aria-pressed="true"]{background:#1F9D55}
---
> .o-btn[aria-pressed="true"]{background:#C53030}
```
(sortie brute de `sed … reference-original.html | diff reference-original.html -`, mêmes substitutions que pour la copie.)

Sortie réelle (`run-casse.log`), code de sortie **1** :
```
=== RÉSUMÉ ===
{"duree_s":62,"assertions":182,"reussies":153,"echecs":29,"parPoint":{"§10.1":"33/33","§3.1":"32/32","§10.2":"12/24","§9":"24/36","§10.3":"7/7","§6.2":"7/7","§10.4":"10/10","§10.5":"5/5","§10.7":"6/11","§6.6":"1/1","§10.6":"4/4","§2":"1/1","§4":"1/1","§1":"1/1","§10.8":"9/9"},"cibles":{"a":"testée"},"divergences"

29 ÉCHEC(S) :
 - [a] §10.2 #/ 1440x860 clair défilement vertical du document
     attendu: 0
     obtenu : 140
 - [a] §9 #/ 1440x860 clair éléments hors écran hors conteneur défilant
     attendu: 0
     obtenu : [{"el":"div.app","bas":1000,"droite":1440},{"el":"div.app > div.main","bas":1000,"droite":1440},{"el":"div.app > div.main > main#view.content","bas":1000,"droite":1440},{"el":"div.app > div.main > main#view.content > div.dp.home","bas":980,"droite":1408},{"el":"div.main > main#view.content > div.dp.home > div.ov.ho
 - [a] §10.2 #/f/b1 1440x860 clair défilement vertical du document
     attendu: 0
     obtenu : 140
 - [a] §9 #/f/b1 1440x860 clair éléments hors écran hors conteneur défilant
     attendu: 0
     obtenu : [{"el":"div.app","bas":1000,"droite":1440},{"el":"div.app > div.main","bas":1000,"droite":1440},{"el":"div.app > div.main > main#view.content","bas":1000,"droite":1440},{"el":"div.app > div.main > main#view.content > div.dp","bas":980,"droite":1408},{"el":"div.main > main#view.content > div.dp > div.dp-grid","bas":
 - [a] §10.2 #/archive/b0 1440x860 clair défilement vertical du document
     attendu: 0
     obtenu : 140
 - [a] §9 #/archive/b0 1440x860 clair éléments hors écran hors conteneur défilant
     attendu: 0
     obtenu : [{"el":"div.app","bas":1000,"droite":1440},{"el":"div.app > div.main","bas":1000,"droite":1440},{"el":"div.app > div.main > main#view.content","bas":1000,"droite":1440},{"el":"div.app > div.main > main#view.content > div.dp","bas":980,"droite":1408},{"el":"div.main > main#view.content > div.dp > div.dp-grid.arch","
 - [a] §10.2 #/ 1440x860 sombre défilement vertical du document
     attendu: 0
     obtenu : 140
 - [a] §9 #/ 1440x860 sombre éléments hors écran hors conteneur défilant
     attendu: 0
     obtenu : [{"el":"div.app","bas":1000,"droite":1440},{"el":"div.app > div.main","bas":1000,"droite":1440},{"el":"div.app > div.main > main#view.content","bas":1000,"droite":1440},{"el":"div.app > div.main > main#view.content > div.dp.home","bas":980,"droite":1408},{"el":"div.main > main#view.content > div.dp.home > div.ov.ho
 - [a] §10.2 #/f/b1 1440x860 sombre défilement vertical du document
     attendu: 0
     obtenu : 140
 - [a] §9 #/f/b1 1440x860 sombre éléments hors écran hors conteneur défilant
     attendu: 0
     obtenu : [{"el":"div.app","bas":1000,"droite":1440},{"el":"div.app > div.main","bas":1000,"droite":1440},{"el":"div.app > div.main > main#view.content","bas":1000,"droite":1440},{"el":"div.app > div.main > main#view.content > div.dp","bas":980,"droite":1408},{"el":"div.main > main#view.content > div.dp > div.dp-grid","bas":
 - [a] §10.2 #/archive/b0 1440x860 sombre défilement vertical du document
     attendu: 0
     obtenu : 140
 - [a] §9 #/archive/b0 1440x860 sombre éléments hors écran hors conteneur défilant
     attendu: 0
     obtenu : [{"el":"div.app","bas":1000,"droite":1440},{"el":"div.app > div.main","bas":1000,"droite":1440},{"el":"div.app > div.main > main#view.content","bas":1000,"droite":1440},{"el":"div.app > div.main > main#view.content > div.dp","bas":980,"droite":1408},{"el":"div.main > main#view.content > div.dp > div.dp-grid.arch","
 - [a] §10.2 #/ 1280x720 clair défilement vertical du document
     attendu: 0
     obtenu : 280
 - [a] §9 #/ 1280x720 clair éléments hors écran hors conteneur défilant
     attendu: 0
     obtenu : [{"el":"div.app","bas":1000,"droite":1280},{"el":"div.app > div.main","bas":1000,"droite":1280},{"el":"div.app > div.main > main#view.content","bas":1000,"droite":1280},{"el":"div.app > div.main > main#view.content > div.dp.home","bas":980,"droite":1248},{"el":"div.main > main#view.content > div.dp.home > div.ov.ho
 - [a] §10.2 #/f/b1 1280x720 clair défilement vertical du document
     attendu: 0
     obtenu : 280
 - [a] §9 #/f/b1 1280x720 clair éléments hors écran hors conteneur défilant
     attendu: 0
     obtenu : [{"el":"div.app","bas":1000,"droite":1280},{"el":"div.app > div.main","bas":1000,"droite":1280},{"el":"div.app > div.main > main#view.content","bas":1000,"droite":1280},{"el":"div.app > div.main > main#view.content > div.dp","bas":980,"droite":1248},{"el":"div.main > main#view.content > div.dp > div.dp-grid","bas":
 - [a] §10.2 #/archive/b0 1280x720 clair défilement vertical du document
     attendu: 0
     obtenu : 280
 - [a] §9 #/archive/b0 1280x720 clair éléments hors écran hors conteneur défilant
     attendu: 0
     obtenu : [{"el":"div.app","bas":1000,"droite":1280},{"el":"div.app > div.main","bas":1000,"droite":1280},{"el":"div.app > div.main > main#view.content","bas":1000,"droite":1280},{"el":"div.app > div.main > main#view.content > div.dp","bas":980,"droite":1248},{"el":"div.main > main#view.content > div.dp > div.dp-grid.arch","
 - [a] §10.2 #/ 1280x720 sombre défilement vertical du document
     attendu: 0
     obtenu : 280
 - [a] §9 #/ 1280x720 sombre éléments hors écran hors conteneur défilant
     attendu: 0
     obtenu : [{"el":"div.app","bas":1000,"droite":1280},{"el":"div.app > div.main","bas":1000,"droite":1280},{"el":"div.app > div.main > main#view.content","bas":1000,"droite":1280},{"el":"div.app > div.main > main#view.content > div.dp.home","bas":980,"droite":1248},{"el":"div.main > main#view.content > div.dp.home > div.ov.ho
 - [a] §10.2 #/f/b1 1280x720 sombre défilement vertical du document
     attendu: 0
     obtenu : 280
 - [a] §9 #/f/b1 1280x720 sombre éléments hors écran hors conteneur défilant
     attendu: 0
     obtenu : [{"el":"div.app","bas":1000,"droite":1280},{"el":"div.app > div.main","bas":1000,"droite":1280},{"el":"div.app > div.main > main#view.content","bas":1000,"droite":1280},{"el":"div.app > div.main > main#view.content > div.dp","bas":980,"droite":1248},{"el":"div.main > main#view.content > div.dp > div.dp-grid","bas":
 - [a] §10.2 #/archive/b0 1280x720 sombre défilement vertical du document
     attendu: 0
     obtenu : 280
 - [a] §9 #/archive/b0 1280x720 sombre éléments hors écran hors conteneur défilant
     attendu: 0
     obtenu : [{"el":"div.app","bas":1000,"droite":1280},{"el":"div.app > div.main","bas":1000,"droite":1280},{"el":"div.app > div.main > main#view.content","bas":1000,"droite":1280},{"el":"div.app > div.main > main#view.content > div.dp","bas":980,"droite":1248},{"el":"div.main > main#view.content > div.dp > div.dp-grid.arch","
 - [a] §10.7 Prise 1 : bascule au clic
     attendu: "ON/rgb(31, 157, 85)"
     obtenu : "ON/rgb(197, 48, 48)"
 - [a] §10.7 Prise 2 : bascule au clic
     attendu: "ON/rgb(31, 157, 85)"
     obtenu : "ON/rgb(197, 48, 48)"
 - [a] §10.7 Prise 3 : bascule au clic
     attendu: "ON/rgb(31, 157, 85)"
     obtenu : "ON/rgb(197, 48, 48)"
 - [a] §10.7 Prise 4 : bascule au clic
     attendu: "ON/rgb(31, 157, 85)"
     obtenu : "ON/rgb(197, 48, 48)"
 - [a] §10.7 Prise 5 : bascule au clic
     attendu: "ON/rgb(31, 157, 85)"
     obtenu : "ON/rgb(197, 48, 48)"
Rapport JSON : C:\Users\Timothée\Documents\IA\Hermes\FermentationLab2\_verify\sortie-casse\rapport.json
```

Résultat attendu obtenu : 12 échecs §10.2 « défilement vertical du document » (140 px en 860, 280 px en 720),
12 échecs §9 « éléments hors écran », et 5 échecs §10.7 « bascule au clic » (`ON/rgb(197, 48, 48)` au lieu de
`ON/rgb(31, 157, 85)`). Le débordement `#arch-2` disparaît dans la copie (cellule plus haute), ce qui est cohérent.
La copie a été supprimée ensuite (`rm -f _casse.html` ; `ls _casse.html` → « No such file or directory »).

Deuxième preuve négative, pour le **comparateur A/B** (sinon un « 0 divergence » ne prouverait rien) :
copie `_casse-b.html` avec un libellé (`Voir les recettes` → `Voir recettes`) et un nombre (consigne de la recette
r1 `temp:24` → `temp:25`) modifiés, comparée à A (`run-casse-b.log`), code de sortie **1** :
```
lignes DIVERGENCE : 100
  DIVERGENCE #/ 1440x860 clair boutons[2]
      A: "Voir les recettes"
      B: "Voir recettes"
  DIVERGENCE #/ 1440x860 clair tuiles[2]
      A: "Bière«direct» Saison du Nord #3 Démarrée le 14 sept., 21 jours prévus Température«direct»°C Cible24,0°C Densité1,008 Jour 10 sur 2144 %"
      B: "Bière«direct» Saison du Nord #3 Démarrée le 14 sept., 21 jours prévus Température«direct»°C Cible25,0°C Densité1,008 Jour 10 sur 2144 %"
  DIVERGENCE #/ 1440x860 clair activite[3]
      A: "Ceinture chauffante : désactivation de la chauffe à 24,2 °Cil y a «…»"
      B: "Ceinture chauffante : désactivation de la chauffe à 25,2 °Cil y a «…»"
--
  DIVERGENCE #/f/b1 1440x860 clair kpis[1]
      A: "Consigne24,0°CTolérance ±0,5 °C"
      B: "Consigne25,0°CTolérance ±0,5 °C"
  ÉCHEC [a/b] A=B divergences A/B (compteurs, libellés, nombres normalisés) — attendu: 0 | obtenu: 100
{"duree_s":127,"assertions":365,"reussies":360,"echecs":5,"parPoint":{"§10.1":"66/66","§3.1":"64/64","§10.2":"48/48","§9":"68/72","§10.3":"14/14","§6.2":"14/14","§10.4":"20/20","§10.5":"10/10"
 - [a/b] A=B divergences A/B (compteurs, libellés, nombres normalisés)
```
(100 est le nombre total de divergences de `sortie-casse-b/rapport.json` ; toutes sont imprimées, le plafond d'affichage étant 200.)
Copie supprimée ensuite (`ls _casse-b.html` → « No such file or directory »).

## 4. Comparaison A / B (`run-deux.log`) — code de sortie 1

Au moment de l'exécution, B répondait `HTTP 200`, 120430 octets, et `cmp ../hakko-dashboard.html reference-original.html`
affichait « B fichier identique à A sur disque ».
```
[a] http://127.0.0.1:8811/_verify/reference-original.html — passe mise en page (8 routes × 2 thèmes × 2 viewports)
[a] passe fonctionnelle (§10)
[b] http://127.0.0.1:8812/hakko-dashboard.html — passe mise en page (8 routes × 2 thèmes × 2 viewports)
[b] passe fonctionnelle (§10)
  OK  [a/b] A=B divergences A/B (compteurs, libellés, nombres normalisés) — attendu: 0 | obtenu: 0
{"duree_s":124,"assertions":365,"reussies":361,"echecs":4,"parPoint":{"§10.1":"66/66","§3.1":"64/64","§10.2":"48/48","§9":"68/72","§10.3":"14/14","§6.2":"14/14","§10.4":"20/20","§10.5":"10/10"
=== RÉSUMÉ ===
{"duree_s":124,"assertions":365,"reussies":361,"echecs":4,"parPoint":{"§10.1":"66/66","§3.1":"64/64","§10.2":"48/48","§9":"68/72","§10.3":"14/14","§6.2":"14/14","§10.4":"20/20","§10.5":"10/10","§10.7":"22/22","§6.6":"2/2","§10.6":"8/8","§2":"2/2","§4":"2/2","§1":"2/2","§10.8":"18/18","A=B":"1/1"},"cibles":{"a":"te

4 ÉCHEC(S) :
 - [a] §9 #/archive/b0 1280x720 clair débordements enfant→conteneur
     attendu: 0
     obtenu : [{"el":"div.dp-chart-body > div.dp-plot > div#arch-2.chart.fill > svg","px":18.4,"cote":"bas"}]
 - [a] §9 #/archive/b0 1280x720 sombre débordements enfant→conteneur
     attendu: 0
     obtenu : [{"el":"div.dp-chart-body > div.dp-plot > div#arch-2.chart.fill > svg","px":18.4,"cote":"bas"}]
 - [b] §9 #/archive/b0 1280x720 clair débordements enfant→conteneur
     attendu: 0
     obtenu : [{"el":"div.dp-chart-body > div.dp-plot > div#arch-2.chart.fill > svg","px":18.4,"cote":"bas"}]
 - [b] §9 #/archive/b0 1280x720 sombre débordements enfant→conteneur
     attendu: 0
     obtenu : [{"el":"div.dp-chart-body > div.dp-plot > div#arch-2.chart.fill > svg","px":18.4,"cote":"bas"}]
Rapport JSON : C:\Users\Timothée\Documents\IA\Hermes\FermentationLab2\_verify\sortie-deux\rapport.json
```

Bilan : 365 assertions, 361 OK ; **0 divergence A/B** ; les 4 échecs sont le même défaut `#arch-2` (1280×720,
clair/sombre) sur A **et** sur B — B reproduit fidèlement la référence, défaut compris.

## 5. Conclusions

| Échec | Où | Cause | Statut |
|---|---|---|---|
| `span` inline des KPI « déborde » de 2 px | itération 1 | harnais (rect inline ≠ boîte de ligne) | corrigé |
| Timeout sur `#/f/b4` | itération 1 | harnais (redirection non attendue) | corrigé |
| §10.3 0 valeur changée en 2 ticks | itération 2 | harnais (arrondi d'affichage, fenêtre trop courte) | corrigé |
| `#arch-2 > svg` déborde de 18,4 px, axe sur la légende | `#/archive/b0` 1280×720, A et B | application (Annexe C `Math.max(120, …)` + `overflow:visible` ; §10.2/§9) | conservé |

Conséquence pour le parent : avec la référence actuelle, **le code de sortie vaut 1 même pour un B parfait**
(4 échecs attendus en mode `deux`, 2 en mode `a` ou `b`). Pour juger B, lire `rapport.json`
(`resume`, `divergences`) plutôt que le seul code de sortie, ou décider explicitement de tolérer ce défaut connu.

## 6. Ce que je n'ai pas pu vérifier

- Fidélité visuelle pixel à pixel : des captures sont produites (`sortie-*/*.png`) mais non comparées entre A et B ;
  seules `--bg` et les couleurs ON/OFF sont vérifiées par valeur calculée.
- Responsive sous 1100 px et 900 px (barre d'onglets, tableaux `.stack`) : hors des deux viewports demandés.
- La date du relevé de densité est posée par `value` + événements `input`/`change` sur le `datetime-local`
  (la saisie clavier de ce champ dépend de la locale d'Edge) ; la densité, la note et la consigne sont saisies au clavier/au clic.
- Conservation du scroll testée sur `#feed` et `#journal-list` seulement (pas sur lots, état des appareils,
  appareils reliés, paramètres).
- Hors §10 : édition/création/archivage de recette, dialogue « Ajouter un appareil », recherche et filtres,
  suppression de relevé — non exercés.
- La passe de mise en page tourne avec une horloge virtuelle et un `Math.random` à graine fixe (nécessaire à la
  comparaison A/B) ; seule la passe fonctionnelle tourne en horloge réelle.
- La passe fonctionnelle n'est exécutée qu'en thème clair à 1440×860 (le thème sombre est vérifié en rendu et par
  le bouton de thème, pas pour chaque interaction).
- B était identique octet pour octet à A au moment de la course : le « 0 divergence » ne dit rien d'un futur build
  différent, d'où la preuve négative du comparateur (§3).
- Moteur unique : Edge headless shell, facteur d'échelle 1.
