# Avis d'arbitrage — protocole des données partagées

Date : 2026-10-03. Objet : `design/protocole-donnees-partagees.md`.
Version arbitrée : `design/protocole-donnees-partagees-v2.md`.
Aucun fichier de code n'a été modifié.

---

## 1. Attaque du protocole

### 1.1 La contradiction de fond : §2.A dit « opaque », §4 dit « interprété »

`protocole-donnees-partagees.md:20-22` : « Il ne l'interprète pas : il le stocke. »
`protocole-donnees-partagees.md:55-61` : le pont lit `donnees.batches`, `donnees.recipes`,
`donnees.devices`, le champ d'appartenance au lot, le `eid`, la marque de démonstration.

Ce ne sont pas deux phrases qui coexistent, c'est une seule décision prise deux fois dans
deux sens. Tant qu'elle n'est pas tranchée, l'implémenteur choisit — et choisira « opaque »,
parce que c'est plus simple, puis rattrapera la déduction avec des `.get()` défensifs sans
contrat. La v2 tranche : **document semi-opaque**, une tranche de régulation validée champ
par champ, un reste stocké sans être lu (§2.A de la v2).

### 1.2 Où l'on perd une recette

**(a) Au-dessus de 1 Mio, l'écriture échoue en silence.**
`protocole-donnees-partagees.md:32` annonce 2 Mio. Or `nginx.conf:74-82` ne déclare aucun
`client_max_body_size` dans `location /api/` : le défaut nginx est 1 Mio. Un document de
1,4 Mio est donc refusé **par nginx**, avant le pont, avec une page d'erreur HTML. Côté page,
le patron d'appel existant (`hakko-dashboard.html:1781-1783`) traite `!r.ok` et un `r.json()`
qui lève par un `return false` muet. L'utilisateur voit son interface normale, continue
d'éditer, et rien ne part plus. Et 1 Mio est atteignable : `HIST_MAX = 4320` points par lot
(`hakko-dashboard.html:930`), quatre lots actifs, plus `S.events` et `S.eventsArchive`.

Accessoirement, 2 Mio est de toute façon impossible sans toucher `CORPS_MAX = 4096`
(`pont/pont.py:50`), qui s'applique aujourd'hui à **tous** les POST (`pont/pont.py:900`).

**(b) À la première coupure de courant, le document peut être vide.**
`pont/pont.py:399-405` écrit le temporaire puis `os.replace`, sans `flush`, sans
`os.fsync(f.fileno())`, sans fsync du répertoire. Pour le plan actuel c'est tolérable : la
page le redépose toutes les dix minutes (`hakko-dashboard.html:1777`). Pour la **seule copie
de la vérité**, un `os.replace` durable dont les blocs de données ne le sont pas donne un
`donnees.json` tronqué, donc illisible, donc — par `protocole-donnees-partagees.md:63-65` —
un pont qui conserve indéfiniment son plan précédent sur des données que plus personne ne
possède. Dans un labo où des résistances chauffent, la coupure brutale n'est pas un cas
d'école.

**(c) L'échec d'écriture n'a pas de code de retour.**
`protocole-donnees-partagees.md:41-47` décrit le succès et le 409. Rien sur l'`OSError`.
Si `rev` est incrémenté avant que le `os.replace` ait réussi, le client suivant obtient un
409 contre une révision qui n'existe sur aucun disque, « adopte », et perd son travail au
profit de rien.

**(d) « Adopter » n'est pas défini, et c'est pourtant là que les données meurent.**
`protocole-donnees-partagees.md:45-46` : « Le client n'écrase jamais : il adopte ou demande à
son utilisateur. » Adopter, c'est appeler `localStorage.setItem(STORE, …)`
(`hakko-dashboard.html:835`) sur la clé `hakko-dashboard-v2` (`hakko-dashboard.html:762`).
La version refusée disparaît. La sauvegarde prévue au §5
(`protocole-donnees-partagees.md:71-72`) est écrite par l'appareil qui **pousse** ; la perte,
elle, a lieu chez celui qui **adopte**. La garde est du mauvais côté.

**(e) `save()` élague, et l'élagage deviendrait contagieux.**
`hakko-dashboard.html:841-849` : quota plein → `S.hist[k].slice(…)` puis
`S.eventsArchive = []`. Destructif, et assumé comme tel localement. Si `S` part tel quel vers
le pont, le quota plein du PC supprime l'historique de mesures du téléphone. Le protocole
n'en dit rien.

**(f) Le document ne survit pas à une authentification ouverte.**
`k8s/deployment.yaml:93-94` : `PONT_AUTH=aucune`. Avec `/api/regul`, le dégât était
transitoire — la page redéposait son plan dans les dix minutes
(`hakko-dashboard.html:1777`). Avec un document persistant, n'importe quelle machine du
réseau écrit `rev+1`, et les pages légitimes, en suivant `protocole-donnees-partagees.md:72-74`
et `:78-81`, **adoptent**. Une écriture non authentifiée devient la destruction définitive de
tous les relevés. Le commentaire de `deployment.yaml:85-92` assume le risque pour les prises ;
il n'a pas été écrit pour des archives.

### 1.3 Où un appareil périmé impose encore une chauffe

**(a) L'affirmation du §2.B est fausse.**
`protocole-donnees-partagees.md:26-27` : « un appareil périmé ne peut plus imposer ses lots,
puisque plus personne ne dépose de plan ». Le plan n'est plus déposé, mais **le document
l'est**. Le 409 compare des **révisions**, pas des **contenus**. Suite d'actions complète :
le téléphone, hors ligne depuis huit jours, se rafraîchit, lit `rev: 83`, voit « les données
partagées remplacent les vôtres », et choisit — `protocole-donnees-partagees.md:80-81` le
permet explicitement, « on avertit et on laisse choisir » — de garder les siennes. Il écrit
`base: 83` avec son document de huit jours. La révision concorde. Le pont accepte. Le lot
`b1`, archivé depuis six jours sur le PC, repasse `status: "active"`, et le pont — qui déduit
désormais tout seul, sans qu'aucune page soit ouverte — rallume la prise. Le défaut d'origine
(`protocole-donnees-partagees.md:13-16`) est intégralement reconstitué, avec une page de moins
dans la boucle.

**(b) `POST /api/regul` gardé « en secours » rouvrirait la porte au pire moment.**
C'est la question 4 du §9 (`protocole-donnees-partagees.md:112-113`). Le chemin de secours
s'active précisément quand le document est illisible, c'est-à-dire quand personne ne peut
vérifier ce que le plan déposé contredit.

**(c) Le plan gelé n'a pas d'échéance.**
`protocole-donnees-partagees.md:63-65` : en cas d'illisibilité, « on conserve le plan
précédent ». Pour toujours. Un lot archivé par l'utilisateur au moment même où le fichier
devient illisible continue de chauffer indéfiniment, et la page ne peut plus rien écrire pour
le contredire. Le code contient déjà le bon patron pour ce cas : à
`pont/pont.py:688-697`, devant une mesure non rafraîchie, le pont ne coupe pas tout de suite
mais **cesse de repousser l'échéance**, et le plafond de chauffe
(`k8s/deployment.yaml:106-107`, appliqué en `pont/pont.py:709-712`) finit le travail. Le §4
doit en faire autant.

**(d) La consigne prise dans `donnees.recipes` est une régression.**
`protocole-donnees-partagees.md:57` : « sa consigne et son écart viennent de sa recette
(`donnees.recipes`) ». Mais un lot porte une **copie figée** de sa recette :
`recipe: snap('r1'), recipeId: 'r1'` (`hakko-dashboard.html:794`, fonction
`hakko-dashboard.html:791`), et c'est cette copie que la page utilise aujourd'hui
(`hakko-dashboard.html:1727`, `:1733`). Conséquences du §4 tel qu'écrit : éditer une recette
change la consigne d'une fermentation en cours ; supprimer une recette — le geste même qui a
révélé le bug — fait disparaître la consigne, donc le lot du plan déduit, donc la chauffe d'un
lot que l'utilisateur croit actif.

**(e) « Les appareils rattachés » peut désigner la sonde d'humidité.**
`protocole-donnees-partagees.md:58-60` dit « sa sonde … vient des appareils qui lui sont
rattachés ». Or `h1`, `kind:'hum'`, est rattachée à `b3` (`hakko-dashboard.html:819`) et son
`eid` figure dans `PONT_SONDES` (`k8s/deployment.yaml:124`). La page filtre sur
`kind === 'temp'` (`hakko-dashboard.html:1730-1732`) ; le §4 ne le dit pas. Le garde-fou
d'unité du pont (`pont/pont.py:663-668`) rattrape la faute, mais en refusant de réguler : le
lot ne chauffe plus du tout, et le motif est enterré dans les décisions.

**(f) Une page fraîche qui réensemence commande de vraies prises.**
`hakko-dashboard.html:828-830` : `if (!S || !S.recipes) S = seed();`. `seed()`
(`hakko-dashboard.html:763-827`) produit cinq lots dont quatre `status:'active'` et neuf
appareils dont les `eid` sont **les vraies prises** de `k8s/deployment.yaml:122-124`. Les
prises de démonstration portent `demo: true` (`hakko-dashboard.html:820-822`) et
`protocole-donnees-partagees.md:60` les exclut — mais la marque tombe au premier geste de
l'utilisateur : `delete d.demo` (`hakko-dashboard.html:2708`). Le lot de démonstration
« Saison du Nord #3 », consigne 24 °C, devient alors un plan actif sur une prise réelle.

### 1.4 Ce que le 409 strict ne couvre pas

1. **Le contenu périmé sous une révision fraîche** — §1.3(a). C'est le trou central.
2. **Deux ponts, deux compteurs.** `k8s/deployment.yaml:17-21` : `RollingUpdate`,
   `maxUnavailable: 0`, `maxSurge: 1`, avec un PVC `ReadWriteOnce`
   (`k8s/pvc-pont-etat.yaml:19-20`) sur un nœud unique — donc deux pods montent le même
   `/data` pendant le déploiement, et les deux lancent `regulation()`
   (`pont/pont.py:1004`). Si `rev` vit en mémoire, chaque processus a son compteur : les deux
   acceptent `base == leur rev`, le second `os.replace` écrase le premier, **aucun 409 n'est
   émis**. La perte de mise à jour que le 409 existe pour empêcher passe par le seul chemin
   que le 409 ne voit pas.
3. **L'écriture réussie prise pour un échec.** `nginx.conf:81` coupe à
   `proxy_read_timeout 20s`. Le POST aboutit côté pont, la page ne reçoit rien, rejoue avec
   l'ancien `base`, reçoit un 409, annonce à l'utilisateur que ses données sont périmées — et
   lui propose d'adopter ce qu'il vient lui-même d'écrire. Il n'y a pas d'identifiant
   d'opération dans `protocole-donnees-partagees.md:41-47`.
4. **Le conflit permanent, sans aucun utilisateur.** C'est l'omission la plus coûteuse en
   pratique. `pontApplique` réécrit `d.online`, `d.recu`, `d.seen`, `d.on`, `d.origine`,
   `d.origineT`, `d.value`, `d.battery` à **chaque** synchronisation
   (`hakko-dashboard.html:1688-1711`, `:1696-1697`), soit toutes les 15 s
   (`hakko-dashboard.html:2787` : 3 s × `ticPont % 5`). `enregistrerTemperatures` ajoute à
   `S.hist` (`hakko-dashboard.html:1021-1033`). `fraiche()` (`hakko-dashboard.html:910-916`)
   et `surveillance()` dépendent de ces champs. Si le document partagé est `S` tout entier,
   alors chaque appareil le modifie toutes les 15 s, `rev` s'incrémente en continu, et
   **chaque écriture de l'autre appareil part en 409**. L'utilisateur reçoit « les données
   partagées remplacent les vôtres » en boucle, sans avoir rien fait. Le protocole ne
   distingue nulle part la donnée de l'état local volatil.
5. **Le journal à trois écrivains.** Le pont note ses décisions (`pont/pont.py:533-547`), la
   page note les siennes, les deux navigateurs notent. Un journal est par nature
   « append-only » : le 409 strict en perd des lignes à chaque course, de façon routinière et
   non exceptionnelle.
6. **La suppression concurrente.** Recette supprimée sur le PC, recette ajoutée sur le
   téléphone : le perdant du 409 ne garde rien des deux gestes. Tolérable à deux appareils
   — à condition que la version refusée soit conservée, ce que le protocole ne prévoit pas.
7. **L'horloge.** `fin` est un instant absolu en secondes (`pont/pont.py:474-480`), `maj`
   aussi (`protocole-donnees-partagees.md:36`). Un `rev` global est immunisé contre une
   horloge fausse ; tout arbitrage par horodatage client ne l'est pas. À retenir pour la
   question 5.
8. **La trace de ce qui a été commandé sans page ouverte.** Le §2.B promet qu'un lot chauffe
   sans qu'aucune page soit ouverte. Or `_decisions` est plafonné à 60
   (`pont/pont.py:356`), vit en mémoire, et **n'est pas dans ce que `sauver_etat` écrit**
   (`pont/pont.py:392-398`). Il n'est lu que par une page ouverte
   (`hakko-dashboard.html:1748-1770`). Le pont peut donc chauffer trois jours, redémarrer, et
   il ne reste aucune trace de ce qu'il a commuté. Ce n'est pas un trou du 409, c'est un trou
   dans la promesse du §2.B.

---

## 2. Réponse aux cinq questions du §9

### Question 1 — objet opaque unique, ou clés séparées validées une à une ? Et le journal ?

**Décision : document semi-opaque, et le journal comme l'historique de mesures sortent du
document partagé.**

Trois magasins, pas un :

| Magasin | Contenu | Autorité | Transport |
|---|---|---|---|
| `donnees` | `recettes`, `lots`, `appareils` (champs déclaratifs), `reglages` | révision globale, 409 strict | `GET/POST /api/donnees`, 512 Kio |
| `mesures` | `S.hist` | aucune, local par navigateur | non partagé en v2 |
| `decisions` | ce que le pont a commuté | le pont, seul écrivain | `GET /api/decisions?depuis=` |

Raisons, dans l'ordre de force :

1. **Le pont lit déjà le contenu** (`protocole-donnees-partagees.md:55-61`). « Opaque » est
   intenable : la tranche de régulation doit être validée champ par champ, comme
   `valider_lot` le fait aujourd'hui (`pont/pont.py:449-496`). Le reste, lui, n'a aucune
   raison d'être compris par le pont, et chaque champ qu'il comprend est un champ qu'il peut
   refuser à tort.
2. **L'historique de mesures doit sortir, sans quoi le protocole est inutilisable.** Il est
   réécrit toutes les trois minutes par chaque appareil (`hakko-dashboard.html:1021-1033`),
   il pèse l'essentiel des octets (`HIST_MAX = 4320` par lot, `hakko-dashboard.html:930`), et
   le partager garantit le conflit permanent décrit en §1.4(4). Effet secondaire bénéfique :
   une adoption n'efface plus les mesures de l'appareil qui adopte.
3. **Le journal doit sortir, mais en gagnant un écrivain faisant autorité.** Trois
   écrivains sur une structure append-only, arbitrés par un 409 sur le document entier,
   perdent des lignes à chaque course. En v2, le journal d'événements reste local à chaque
   navigateur, et ce qui compte pour la sûreté — les commutations réelles — devient un
   magasin à part, écrit **par le pont** dans un fichier append-only de `/data`, plafonné et
   tourné, servi par `GET /api/decisions?depuis=<t>`. Chaque page le fusionne en lecture
   seule. C'est aussi ce qui comble §1.4(8).
4. **Taille : 512 Kio, pas 2 Mio.** `nginx.conf:74-82` plafonne à 1 Mio par défaut ; le pont
   est limité à 64 Mi de mémoire (`k8s/deployment.yaml:148-154`) et sérialise toute la
   réponse en mémoire (`pont/pont.py:788-803`) sur un serveur à threads
   (`pont/pont.py:1004-1006`) ; le volume fait 8 Mi (`k8s/pvc-pont-etat.yaml:23`) et une
   écriture atomique avec copie précédente en demande trois fois la taille. Avec les mesures
   et le journal dehors, 512 Kio est très large.

**Coût assumé :** le PC ne verra pas les clics faits sur le téléphone dans son « Activité
récente ». Il verra en revanche toutes les commutations réelles, par `GET /api/decisions`.
C'est le bon partage : le journal d'interface est un confort, la trace des relais est une
obligation.

### Question 2 — qui gagne, 409 strict ou fusion par lot ?

**Décision : 409 strict, conservé, mais « le perdant adopte » est refusé. Trois ajouts
obligatoires.**

La fusion par lot est écartée pour une raison précise : elle doit choisir entre « recette
supprimée sur le PC » et « recette éditée sur le téléphone ». Le défaut d'origine
(`protocole-donnees-partagees.md:13-16`) est exactement une suppression qui ne s'est pas
propagée. Une fusion qui garde les deux la ressuscite. On remplacerait un bug visible par un
bug dont la victime est une prise électrique.

Le 409 strict est assez sûr à deux appareils **si et seulement si** :

- **(a) La version refusée est conservée, jamais écrasée.** Avant toute adoption, la page
  écrit son état courant sous une clé datée distincte — `hakko-dashboard-v2-refuse-<ms>`,
  trois générations — et l'annonce : « votre version du 3 oct. 14:12 a été refusée :
  comparer / réappliquer / exporter ». Sans cela, « adopter » est un synonyme de « perdre »
  (§1.2(d)).
- **(b) Une seule écriture en vol, et jamais d'adoption pendant une saisie.** `S` est un
  global muté partout (`hakko-dashboard.html:828`), sauvé par le `setInterval` de 3 s
  (`hakko-dashboard.html:2787`) **et** par chaque gestionnaire. Sans file d'attente à une
  place, deux POST de la même page portent le même `base` et le second se conflicte avec
  lui-même. `base` ne se met à jour que depuis la réponse du pont, et une adoption attend la
  fermeture de `<dialog id="dlg">` (`hakko-dashboard.html:692`).
- **(c) Un identifiant d'opération.** `op` dans le POST, réécho dans la réponse et dans le
  409 : un rejeu après le `proxy_read_timeout 20s` de `nginx.conf:81` doit être reconnu comme
  la même écriture et obtenir 200, pas 409 (§1.4(3)).

Et un préalable sans lequel le 409 strict est insupportable : l'état local volatil sort du
document (question 1), faute de quoi le conflit survient toutes les 15 s sans utilisateur.

### Question 3 — le pont doit-il refuser un document qui casserait la régulation ?

**Décision : il l'accepte, il refuse le plan, et il le dit dans sa réponse.**

Le pont refuse à l'écriture **uniquement** ce qui est structurellement instockable : corps
non-objet, `donnees` absent / `null` / non-objet, dépassement de taille, clé racine inconnue.

Tout ce qui ne casse que la régulation — lot actif sans sonde de température, prise hors liste
blanche, consigne hors bornes, deux sondes de température sur un lot — est **écrit**, renvoyé
dans `avertissements[]` du 200, et le lot concerné est **exclu du plan déduit** puis listé
dans `exclus[{lot, motif}]` de `GET /api/regul`.

Trois raisons :

1. Refuser l'écriture, c'est empêcher d'enregistrer un lot à moitié configuré. L'utilisateur
   saisirait sa recette, serait refusé, et perdrait sa saisie — on reconstruit la perte de
   données qu'on prétend corriger.
2. Le pont deviendrait éditeur de sa propre vérité. Deux appareils de version logicielle
   différente auraient alors deux idées de ce qui est écrivable, et l'un verrait ses
   écritures refusées sans pouvoir comprendre pourquoi.
3. **Le sens sûr est déjà l'exclusion.** Exclure un lot du plan ne lance pas une chauffe, elle
   l'arrête : `couper_orphelines` (`pont/pont.py:576-586`) coupe ce qu'aucun lot actif ne
   réclame. Refuser le plan est donc la décision prudente ; refuser le document est la
   décision risquée.

Une exception, non négociable : une prise hors `PONT_PRISES` est refusée **dans le plan**,
jamais dans le document, exactement comme aujourd'hui (`pont/pont.py:463-467`,
`protocole-donnees-partagees.md:61-62`).

### Question 4 — garder `POST /api/regul` comme chemin de secours ?

**Décision : non. Supprimé, et la route doit répondre 410, pas 404.**

Le chemin de secours *est* le défaut. Toute la valeur du §2.B tient à ce qu'aucun appareil ne
puisse imposer un plan ; une porte ouverte « quand le document est illisible » rouvre le
scénario du bug d'origine exactement au moment où personne ne peut vérifier ce que ce plan
contredit.

Le besoin réel derrière la question — que faire quand le document est illisible ? — se traite
au §4 par une dégradation **bornée** : on garde le plan précédent, et au-delà de dix minutes
d'illisibilité on cesse de repousser l'échéance de sécurité, de sorte que le plafond de 90 min
(`k8s/deployment.yaml:106-107`, `pont/pont.py:709-712`) coupe. C'est le patron déjà employé
pour une mesure non rafraîchie (`pont/pont.py:688-697`). Pas une voie d'écriture.

**410 et non 404 :** une page déjà ouverte tourne des jours (`setInterval` de
`hakko-dashboard.html:2787`) et son code de dépôt traite un échec par un `return false` muet
(`hakko-dashboard.html:1781-1783`). Un 404 est indistinguable d'un incident passager ; un 410
lui dit de se recharger. `GET /api/regul` reste, en lecture seule, comme au
`protocole-donnees-partagees.md:50-51`.

### Question 5 — horodatage par lot plutôt que révision globale ?

**Décision : non pour l'arbitrage des conflits. Oui comme champ non faisant autorité, pour une
seule garde.**

La révision globale reste le seul arbitre. Un horodatage client est une autorité confiée à une
horloge que le protocole ne contrôle pas : un téléphone remis à la main, une tablette dont la
pile s'est vidée, et son lot de la semaine dernière gagne définitivement — sur un système qui
commande des résistances. Le `rev` global, lui, est insensible à l'horloge.

Mais chaque lot porte `maj`, **apposé par le pont** à l'écriture, jamais accepté du client.
Le pont en conserve le dernier connu par identifiant de lot, dans `/data`, et s'en sert pour
une chose : **un lot `actif` dont le `maj` présenté est antérieur au `maj` déjà enregistré pour
ce même identifiant n'est pas réactivé.** Il est écrit, mais exclu du plan, avec un
avertissement. La réactivation volontaire reste possible, par un champ explicite
`reactiver: ["b1"]` dans le POST, que le pont journalise.

C'est précisément le trou que le 409 ne voit pas : le contenu périmé sous une révision fraîche
(§1.3(a)). Le 409 protège la révision ; `maj` protège le fait qu'un lot archivé ne remonte pas
tout seul sur une prise.

---

## 3. Le protocole corrigé

`design/protocole-donnees-partagees-v2.md`. Les sections modifiées et le motif de chaque
modification sont listés en tête de ce fichier.

---

## 4. Chiffrage du risque de migration

### 4.1 La suite d'actions qui ne doit jamais arriver

Sept étapes, **un seul geste utilisateur**, et une fenêtre de quelques minutes.

1. Le PC utilise le dashboard depuis des mois : `hakko-dashboard-v2`
   (`hakko-dashboard.html:762`) contient ses recettes, ses lots actifs, et les notes d'un miso
   suivi depuis 142 jours (`hakko-dashboard.html:798`).
2. Le volume du pont redevient vide : PVC réappliqué après suppression
   (`k8s/pvc-pont-etat.yaml`), nœud réinstallé, répertoire `local-path` effacé. `GET
   /api/donnees` répond `{rev: 0, donnees: null}`
   (`protocole-donnees-partagees.md:38`).
3. Le téléphone ouvre la page avec un `localStorage` vidé — Safari iOS évince les données de
   site après sept jours sans visite, ou navigation privée, ou « effacer l'historique ».
   `hakko-dashboard.html:829-830` : `S` est nul, donc `S = seed()`
   (`hakko-dashboard.html:763-827`) : six recettes de démonstration, cinq lots dont quatre
   `status:'active'`, neuf appareils dont les `eid` sont les **vraies** prises de
   `k8s/deployment.yaml:122-124`. L'écran est normal : rien n'indique que ce sont des données
   de maquette.
4. Le téléphone voit `rev: 0`, donc le parcours « premier appareil » de
   `protocole-donnees-partagees.md:69-72`. L'utilisateur confirme. **C'est le seul geste.**
5. `POST base: 0` → le pont stocke le document de démonstration, `rev: 1`.
6. Le PC se synchronise, voit `rev: 1 > 0`, applique
   `protocole-donnees-partagees.md:72-74` : « les données partagées remplacent les vôtres »,
   adopte, `localStorage.setItem(STORE, …)` (`hakko-dashboard.html:835`). Les mois de relevés
   sont écrasés. La sauvegarde de `protocole-donnees-partagees.md:71-72` n'a pas été écrite :
   elle n'est prévue que pour l'appareil qui pousse.
7. Le pont déduit son plan. Les prises de démonstration portent `demo: true`
   (`hakko-dashboard.html:820-822`) et `protocole-donnees-partagees.md:60` les exclut — jusqu'au
   premier geste de l'utilisateur sur une prise, où `delete d.demo`
   (`hakko-dashboard.html:2708`) fait tomber la marque. Le lot fictif « Saison du Nord #3 »,
   consigne 24 °C, commande alors une prise réelle.

Perte : toutes les recettes, tous les lots, toutes les notes. Et, avec la décision de la
question 1, **pas** les mesures : `S.hist` reste local, le PC garde ses 142 jours de courbes.
C'est le seul lot de consolation, et c'est un argument de plus pour cette décision.

La même suite s'écrit aussi dans l'autre sens — PC réinstallé, téléphone à jour — et l'étape 6
détruit alors les données du téléphone. La garde doit être symétrique.

### 4.2 Les gardes

Quatre gardes. Chacune suffirait à interrompre la suite ci-dessus ; la v2 exige les quatre,
parce qu'elles échouent dans des circonstances différentes.

**G1 — le sceau d'installation (côté page, bloque l'étape 6).**
Le pont crée à sa première écriture une `semence` aléatoire, stockée dans `/data/semence.json`,
et la renvoie dans chaque réponse. La page conserve la dernière `semence` et le dernier `rev`
vus, sous une clé qu'elle n'effacera jamais. Si la page connaît une `semence` et que le pont en
annonce une autre ou aucune, la page **n'entreprend plus rien automatiquement** : ni dépôt, ni
adoption. Bandeau rouge : « le pont a perdu les données partagées (dernière révision connue :
83, du 2 oct. 18:12). Restaurer depuis cet appareil ? » et un bouton explicite. Le PC de
l'étape 6 ne peut plus adopter.

**G2 — un état ensemencé ne se propose jamais comme référence (côté page, bloque l'étape 4).**
La page marque l'état issu de `seed()` — un seul point d'appel, `hakko-dashboard.html:830` —
et la marque tombe à la première édition de l'utilisateur. Tant qu'elle tient, le bouton
« faire de ces données la référence partagée » est **absent**, remplacé par : « ce navigateur
n'a pas de données à partager — attendez l'autre appareil, ou restaurez une sauvegarde ». Le
téléphone de l'étape 4 n'a plus de geste à faire.

**G3 — adopter sauvegarde, toujours (côté page, rend l'étape 6 réversible).**
Avant tout `setItem(STORE, …)` d'adoption, la page écrit l'état courant sous
`hakko-dashboard-v2-remplace-<ms>`, conserve trois générations, et propose l'export fichier
dans le bandeau. `protocole-donnees-partagees.md:71-72` plaçait la sauvegarde du côté qui ne
perd rien.

**G4 — le pont refuse `base: 0` s'il a déjà détenu un document (côté pont, bloque l'étape 5).**
`semence.json` porte `rev_max`. Sceau présent et `donnees.json` manquant ou illisible →
`POST base: 0` répond **409 `{motif: "semence"}`**, jamais une écriture. Déblocage par un geste
d'exploitant documenté (supprimer `semence.json`), jamais par une page.

**Limite honnête de G4 :** `semence.json` vit sur le même volume que `donnees.json`. Si le
volume entier est effacé — le cas de l'étape 2 — le sceau disparaît avec lui et G4 est muette
exactement quand on en aurait besoin. G4 ne couvre que le document corrompu ou supprimé sur un
volume survivant. C'est pourquoi G1 et G2, qui vivent dans les navigateurs, sont obligatoires
et pas seulement souhaitables.

**Risque résiduel :** volume effacé **et** les deux navigateurs vidés. Plus rien à restaurer,
aucune garde logicielle n'y change quoi que ce soit. La seule défense est un export que
l'utilisateur a réellement fait. La v2 l'exige donc en clair : un bouton « Exporter » toujours
atteignable, et l'export proposé dans le bandeau après toute adoption et après tout 409.

---

## 5. Ce que je n'ai pas tranché

1. **Le partage de l'historique de mesures.** Je l'ai sorti du document pour rendre le 409
   vivable, pas parce que ce soit la bonne fin. Le téléphone ne verra pas les courbes du PC.
   Un magasin append-only par lot (`POST /api/mesures/<lot>`, le pont concatène sans
   arbitrage) le réglerait proprement — je ne l'ai pas conçu, et il doublerait la surface du
   protocole.
2. **`Recreate` contre le verrou de fichier.** J'exige les deux (v2 §7), mais je n'ai pas
   tranché lequel est l'autorité. `strategy: Recreate` sur `k8s/deployment.yaml:17-21` supprime
   la fenêtre à deux ponts au prix de quelques secondes d'indisponibilité — déjà acceptées au
   `k8s/deployment.yaml:14-15`. Un verrou `O_CREAT|O_EXCL` dans le pont survit à un retour en
   arrière du manifeste. Je recommande les deux, et quelqu'un devra décider lequel on
   maintient si l'autre gêne.
3. **La valeur exacte de `DOCUMENT_ILLISIBLE_MAX`.** J'ai posé dix minutes par analogie avec
   la cadence de redépôt actuelle (`hakko-dashboard.html:1777`). Je n'ai aucune mesure pour
   l'étayer, contrairement aux constantes de fraîcheur du pont, qui viennent d'observations
   sur le parc réel (`pont/pont.py:357-363`).
4. **Le passage de `PONT_AUTH` à `jeton`.** Je ferme `/api/donnees` quand
   l'authentification est ouverte (v2 §3), ce qui veut dire que le partage ne fonctionnera pas
   tant que `k8s/deployment.yaml:93-94` dit `aucune`. C'est une décision d'installation qui
   appartient au propriétaire du matériel, pas à un protocole : il faudra basculer, et accepter
   la saisie du jeton sur le téléphone (`hakko-dashboard.html:1797-1804`).
5. **L'écart (`ecart`) réellement voulu.** La page envoie `Math.abs(r.tol)` avec 0,2 par
   défaut (`hakko-dashboard.html:1744`), alors que `TYPES` porte des tolérances par type —
   miso 4,0, koji 2,5 (`hakko-dashboard.html:743-746`) — utilisées seulement pour l'affichage
   (`hakko-dashboard.html:1124`). Un miso régulé à ±0,2 °C, c'est une prise qui commute sans
   arrêt. J'ai figé la reproduction fidèle du comportement actuel pour que la migration ne
   change rien ; savoir si 0,2 est la bonne valeur est une question de procédé, pas de
   protocole.
6. **Ce qu'on fait des `demo: true` déjà persistés.** Des navigateurs portent cette marque,
   d'autres non (`hakko-dashboard.html:807-814`). Au moment de la migration, le document
   partagé en figera un état pour tous. Je n'ai pas décidé si la migration doit les nettoyer,
   les conserver, ou refuser de migrer un document qui en contient encore.
