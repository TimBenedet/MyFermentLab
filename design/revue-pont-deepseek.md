# Revue critique — régulation déplacée dans le pont (`pont.py`) et côté page

**Verdict :** la liste blanche et le « tout ou rien » tiennent, mais la sécurité de bout en bout ne tient pas : trois défauts font qu'une chauffe non surveillée peut ne jamais s'arrêter (fin de lot muette, garde-fou 90 min neutralisé par la repousse, plan/échéances perdus au redémarrage du pod), et le frein de 60 s retarde — sans bloquer — les coupures légitimes.

---

## Défauts

### D1 — La « fin de lot » ne se déclenche jamais (unités incompatibles). **Bloquant.**

- **Fichiers / lignes :** `scada-opus-5.5/hakko-dashboard.html:1736` (et `:712`, `:1733`) ; `scada-opus-5.5/pont/pont.py:452`.
- **Ce qui est faux :** la page calcule `fin` en **millisecondes** (`now = () => Date.now()`, `fin = debut + Number(r.duration) * 3600e3`), mais le pont compare `time.time() >= lot["fin"]`, soit des **secondes** (`time.time()` ≈ 1,79e9) contre des millisecondes (≈ 1,79e12). La condition est donc toujours fausse : la branche « fin de lot prévue atteinte » (`pont.py:452-455`) est du code mort.
- **Deuxième faute, indépendante :** `r.duration` est en **jours** (recettes `duration: 21, 2, 49, 365`), mais le multiplicateur est `3600e3` = **1 heure**. Même si l'unité de comparaison était alignée, `fin` serait `durée_heures` au lieu de `durée_jours`, soit 24× trop court.
- **Comment le prouver :** j'ai déposé un plan avec `fin` en *secondes* (`int(time.time())+35`) : le faux HA a bien journalisé `on` puis `off — fin de lot prévue atteinte`, ce qui confirme que la branche travaille en secondes. La page, elle, envoie des millisecondes. On peut aussi le lire directement : `now = () => Date.now()` (`hakko-dashboard.html:712`).
- **Conséquence :** aucun lot n'est jamais coupé automatiquement à sa durée prévue. Un lot laissé sans onglet ouvert (le cas que le déplacement dans le pont était censé couvrir) chauffe indéfiniment, sauf sonde morte ou clic manuel « Terminer ».

### D2 — La repousse d'échéance neutralise le garde-fou `PONT_CHAUFFE_MAX`. **Bloquant.**

- **Fichier / lignes :** `pont/pont.py:481-488` (repousse), lu avec `:475-480` et `:304-309`.
- **Ce qui est faux :** chaque tour où la prise est allumée et où `v ≤ consigne + écart`, la branche `elif alumees` remet `_echeances[p] = now + 90 min`. Autrement dit, tant que la résistance chauffe sans dépasser la cible, l'échéance est repoussée **toutes les 20 s** et n'arrive jamais à maturité. Le cas exactement visé par le garde-fou — « une chauffe qui n'atteint jamais sa consigne » (résistance sous-dimensionnée, cible physiquement inatteignable, consigne erronée) — est précisément celui où la repousse empêche la coupure.
- **Comment le prouver :** relire `boucle_regulation` : `v < c-h and not alumees` → allume ; `v > c+h and alumees` → coupe ; sinon `elif alumees` → repousse. Pour `v < c-h` **et** `alumees` (chauffe en cours, cible pas atteinte), c'est le `elif alumees` qui s'applique : repousse. Il n'existe aucune borne de durée ni de température qui l'arrête. Reproductible en déposant une consigne 200 °C avec une sonde plafonnée : la prise reste allumée indéfiniment (non testé en 90 min réelles, mais découle directement du code).
- **Conséquence :** la surveillance des 90 min ne protège plus les chauffes régulées ; elle ne coupe plus que le cas « plan retiré / fil bloqué ». Le seul filet restant est la sonde muette.

### D3 — Plan et échéances en mémoire seule : un redémarrage de pod laisse une chauffe orpheline. **Bloquant.**

- **Fichiers / lignes :** `pont/pont.py:154-159` (`_echeances`, `_plan` globaux, aucune persistance), `:749-766` (`main`) ; `k8s/deployment.yaml:151` (`readOnlyRootFilesystem: true`).
- **Ce qui est faux :** si le pod redémarre (RollingUpdate, sonde de vie qui échoue, drain de nœud, resynchronisation ArgoCD) pendant qu'une prise chauffe, le nouveau processus repart avec `_plan = {"lots": []}` et `_echeances = {}`. Personne ne sait plus que la prise chauffe, personne ne la coupe : ni la régulation (pas de plan), ni la surveillance (pas d'échéance), ni le `sans_mesure` (pas de lot).
- **Comment le prouver :** il n'existe aucun écrit sur disque ni relecture de l'état de la prise au démarrage. Le manifeste impose `readOnlyRootFilesystem` ; `main()` ne fait aucune réconciliation initiale. La seule façon de re-déposer le plan est une page ouverte (`hakko-dashboard.html:1745-1754`), qui n'existe pas dans le scénario « page fermée » que le pont est censé garantir.
- **Conséquence :** la garantie « ça fonctionne même si la page est fermée » ne survit pas à un redémarrage du pod.

### D4 — `PONT.regule` peut rester vrai alors que le pont ne régule plus. **À corriger.**

- **Fichier / lignes :** `hakko-dashboard.html:1745` (retour anticipé), `:1752` (seule écriture de `PONT.regule`), `:1756-1771` (`pontLireDecisions` ne lit pas `regule`).
- **Ce qui est faux :** `PONT.regule` n'est mis à jour que lors d'un POST réussi. Le GET `/api/regul` renvoie bien un champ `regule` (`pont.py:642`), mais `pontLireDecisions` ne lit que `decisions`. Si le pont redémarre et perd le plan, la page garde `PONT.regule === true`, `planSig` inchangé et `planT` récent → le retour anticipé `return true` saute le dépôt pendant **jusqu'à 10 minutes**. Pendant ce temps la page désactive sa propre régulation (`!PONT.regule` faux) et le pont ne régule pas non plus : **personne ne régule**. Si la page est fermée au moment du redémarrage, le plan est perdu définitivement.
- **Comment le prouver :** lecture du code (le GET ignore `regule`) ; scénario : redémarrer le pont avec une page ouverte, constater que `PONT.regule` reste vrai et qu'aucun plan n'est redéposé avant 10 min.

### D5 — Deux régulateurs possibles (page) : le dépôt du plan n'est pas soumis au maître. **À corriger** (partiellement traité au déploiement).

- **Fichiers / lignes :** `hakko-dashboard.html:1796` (appel de `pontPoussePlan` non conditionné), `:705-711` (`regulMaitre` ne s'applique qu'à `regulerPont`, jamais au dépôt du plan) ; `:1079` (le battement de cœur n'est écrit que quand `!PONT.regule`).
- **Ce qui est faux :** deux onglets poussent chacun leur plan (dernier écrit gagne) sans arbitrage — `regulMaitre` ne garde que la régulation *locale*. Un onglet ouvert plus tôt, resté sur un état périmé, réécrit son plan toutes les ~10 min et écrase celui d'un onglet plus récent. Symétriquement, un onglet neuf a `PONT.regule = false` le temps de son premier POST : pendant cette fenêtre, `maitreRegul` est vrai (les onglets qui régulent n'émettent plus de battement) et la régulation locale peut commander en même temps que le pont.
- **Note déploiement :** `deployment.yaml` est passé de `replicas: 2` à `replicas: 1` *pendant ma relecture* (un commentaire, lignes 10-15, motive exactement ce risque). Le problème « deux pods = deux régulateurs » est donc écarté côté k8s ; la course multi-onglets côté page subsiste.
- **Comment le prouver :** deux onglets avec des `S.batches` différents, observer que `/api/regul` (GET) renvoie alternativement l'un ou l'autre plan selon l'ordre des POST.

### D6 — `last_updated` d'une sonde saine mais stable peut passer pour « muette ». **À corriger** (à confirmer sur le vrai Home Assistant).

- **Fichier / lignes :** `pont/pont.py:335-347` (`age_mesure`), `:391-406` (`lire_sonde`), `:463-473` (coupure).
- **Ce qui est faux :** la fraîcheur est mesurée sur `last_updated`, qui ne bouge que quand l'intégration écrit un nouvel état. Une sonde Zigbee (les Sonoff du déploiement) qui rapporte sur *changement* seulement — une température parfaitement stable pendant des heures — voit son `last_updated` vieillir sans que la sonde soit morte. Le pont couperait alors une chauffe légitime (coupure à tort), après `sans_mesure_max`.
- **Comment le prouver :** le faux HA fourni met à jour `last_updated` à chaque `__regle`, donc il ne reproduit PAS ce cas. À vérifier sur la vraie sonde en fixant sa valeur.
- **Nuance :** le choix de `last_updated` (plutôt que l'instant de lecture) est le bon ; c'est l'hypothèse « valeur stable ⇒ silencieuse » qui est fragile, et dépend de l'intégration.

### D7 — Une seule panne Home Assistant interrompt tout le tour de régulation, et N appels non mis en cache par tour. **À corriger.**

- **Fichier / lignes :** `pont/pont.py:451` (`etat_prise` hors de tout `try/except`), `:458-462` (seul `lire_sonde` est protégé), `:499-503` (rattrapage global).
- **Ce qui est faux :** `alumees = [p for p in lot["prises"] if etat_prise(p) == "on"]` lit l'état de **chaque prise** par un appel HA non mis en cache, avant même le test de `fin` ou de `actif`. Si HA est injoignable, l'exception remonte et aborde le tour entier : les lots suivants sautent un cycle, y compris leurs coupures de sécurité. Chaque tour fait jusqu'à `prises + 1` appels HA par lot, séquentiellement, sans `CACHE_ETAT`.
- **Comment le prouver :** couper le faux HA pendant qu'un plan à deux lots tourne ; constater dans le journal du pont « tour de régulation interrompu » et qu'aucun lot n'est traité ce tour.

### D8 — Consigne bornée à ±200 °C : trop permissif. **À corriger.**

- **Fichier / ligne :** `pont/pont.py:358` (`-50 <= consigne <= 200`).
- **Ce qui est faux :** 200 °C est une consigne physiquement inatteignable en fermentation ; combinée à D2 (repousse), une faute de frappe ou un plan abusif laisse chauffer indéfiniment. La liste blanche est intacte (aucun contournement trouvé pour les prises ni les sondes, voir « Ce qui est correct »), mais la borne de consigne n'offre aucun garde-fou thermique.
- **Comment le prouver :** déposer un plan consigne 200, sonde à 23 °C : la prise s'allume et ne se coupe jamais (hors sonde morte).

### D9 — Une sonde d'humidité peut servir de « sonde » de régulation en température. **À corriger.**

- **Fichiers / lignes :** `hakko-dashboard.html:1730` (`sonde = appareils.find(d => d.kind === 'temp' || d.kind === 'hum')`) ; `pont/pont.py` ne distingue pas les domaines (`sensor.humidity_1` est dans `PONT_SONDES`, `deployment.yaml:118`).
- **Ce qui est faux :** le plan peut désigner un capteur d'humidité comme sonde d'une consigne en °C. Le pont régule alors la chauffe sur l'humidité (ex. « chauffer tant que HR < 30 % »), ce qui est absurde et peut chauffer en boucle. Rien, ni côté page ni côté pont, ne vérifie l'unité de la sonde.
- **Comment le prouver :** relier un lot à une sonde `hum` sans sonde `temp` ; le plan porte l'entité `hum` avec `consigne = r.temp`.

### D10 — Le frein d'une commande/minute retarde (sans bloquer) les coupures légitimes. **Cosmétique.**

- **Fichier / ligne :** `pont/pont.py:436` (test du frein avant toute commande, sans distinction sécurité/normale).
- **Ce qui est faux :** mesuré à la seconde : la coupure de dépassement (30,5 °C) et la coupure « sonde muette » sont chacune arrivées **exactement 60 s** après l'allumage, parce que le frein venait d'être armé par l'allumage. Le frein ne **bloque** pas (le tour réessaie toutes les 20 s), mais il retarde toute coupure jusqu'à 60 s. Pour un seuil de sonde muette à 15 min, 60 s sont négligeables ; en revanche la coupure de sécurité passe par le même frein que les commandes normales, alors que `surveillance` (qui appelle `commander` directement, `pont.py:532`) en est exemptée.
- **Comment le prouver :** journal du faux HA : `on` 19:02:43 → `off` 19:03:43 ; `on` 19:04:43 → `off` 19:05:43 ; `on` 19:07:23 → `off (fin de lot)` 19:08:23.

### D11 — `actif` accepte tout ce qui n'est pas le booléen `False`. **Cosmétique.**

- **Fichier / ligne :** `pont/pont.py:385` (`"actif": brut.get("actif") is not False`).
- **Ce qui est faux :** `actif: 0`, `""`, `null` sont tous traités comme « actif » (seul `False` au sens d'identité est inactif). Aucune incidence de sécurité (la liste blanche reste le garde-fou), mais l'analyse est surprenante.
- **Comment le prouver :** `0 is not False` vaut `True` en Python.

---

## Ce qui est correct (à dire clairement)

- **Liste blanche réelle :** un plan désignant une prise ou une sonde hors `PONT_PRISES`/`PONT_SONDES` est refusé. Vérifié : dépôt avec `switch.pas_dans_la_liste` → `400 plan refusé` avec le motif exact. Aucun contournement trouvé (le nom du service `turn_on`/`turn_off` est choisi par le pont, l'entité validée).
- **« Tout ou rien » réel :** si un seul lot est invalide, le plan entier est refusé (`pont.py:696-697`) et l'ancien plan reste en place. Atomique, vérifié.
- **La page n'émet aucun ordre quand le pont régule :** confirmé par le code — la régulation locale (`regulerPont`), le garde-fou local (`regulerSecurite`) et `couperSansMesure` sont tous conditionnés à `!PONT.regule` (`hakko-dashboard.html:1079,1085,1100,1818`). La réserve est D4/D5 (le drapeau peut être faux ou périmé).
- **Aucun interblocage de verrous :** `_verrou_plan`, `_verrou_echeances`, `_verrou_etat` ne sont jamais acquis de façon imbriquée ; les copies de lots se font sous verrou (`pont.py:446-448`) ; la re-vérification sous verrou dans `surveillance` (`pont.py:527-530`) ferme la course TOCTOU.
- **Coupure sur sonde `unavailable`/`unknown`/horodatage illisible :** correcte par construction — `lire_sonde` renvoie `valeur=None, age=None` et `boucle_regulation` coupe (`pont.py:400-405,464`). Vérifié par lecture de code (le faux HA ne produit pas d'état `unavailable`).

---

## Scepticisme sur les mesures annoncées

- **« allume à 23 °C »** : **vrai** (vérifié, `on` journalisé à 23,0 °C). Précision : le seuil réel est `consigne − écart = 29,8 °C`, pas 23.
- **« coupe à 30,5 °C »** : **vrai** (vérifié, `off` journalisé à 30,5 °C). Précision : le seuil réel est `consigne + écart = 30,2 °C`, pas 30,5.
- **« coupe si la sonde se tait 7 min »** : **faux** dans les conditions annoncées. Avec `sans_mesure_max: 60` (secondes), le seuil est **60 s**, pas 7 min. Mesuré : sonde rendue périmée (âge 200 s), coupure survenue ~1 min plus tard, message « plus de mesure depuis 3 min ». Le « 7 min » est incompatible avec le plan à 60 s fourni.
- **« la page n'émet aucun ordre quand le pont régule »** : **vrai**, mais seulement tant que `PONT.regule` reflète la réalité (voir D4/D5).
- **« frein de 60 s observé à la seconde »** : **vrai** (écarts de 60 s exacts dans le journal du faux HA).

---

## Ce que je n'ai pas pu vérifier

1. **Le comportement réel de la page dans un navigateur** (deux onglets, fenêtre de régulation d'un onglet neuf, drapeau `PONT.regule` périmé) : analyse sur code uniquement, pas d'exécution du HTML.
2. **Le `last_updated` d'une vraie sonde Sonoff stable** (D6) : le faux HA rafraîchit l'horodatage à chaque réglage, il ne reproduit pas la « valeur stable ⇒ silencieuse ».
3. **Le chemin « sonde `unavailable` »** : vérifié par lecture du code, pas par essai (le faux HA ne génère pas cet état).
4. **Le déclenchement effectif de l'échéance 90 min et le rallumage après coupure de surveillance** : demanderait 90+ min réelles ; déduit du code (D2/D3).
5. **La chauffe indéfinie par repousse (D2) et la consigne 200 °C (D8)** : déduites du code, non laissées tourner 90 min.
6. **Le redémarrage de pod laissant une prise orpheline (D3)** : impossible à reproduire ici (pas de cluster) ; déduit de l'absence de persistance et du manifeste.
7. **Le routage nginx/Service avec `replicas: 1`** : non testé en cluster ; la config `nginx.conf:74-82` est cohérente avec un pont sur `127.0.0.1:8080`.
8. **L'état du dépôt git et les fichiers non listés** (CI, ArgoCD) : non inspectés, hors périmètre.
