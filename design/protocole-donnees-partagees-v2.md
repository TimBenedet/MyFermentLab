# Protocole — données partagées et plan déduit côté pont (v2, arbitrée)

Statut : **version arbitrée**. Contrat d'implémentation.
Date : 2026-10-03. Remplace `design/protocole-donnees-partagees.md`.
Justification des arbitrages : `design/avis-protocole-donnees.md`.
Fichiers concernés : `scada-opus-5.5/pont/pont.py`, `scada-opus-5.5/hakko-dashboard.html`,
`scada-opus-5.5/nginx.conf`, `scada-opus-5.5/k8s/deployment.yaml`,
`scada-opus-5.5/k8s/pvc-pont-etat.yaml`.

---

## Ce que je modifie, et pourquoi

| Section | Modification | Motif |
|---|---|---|
| **§2.A** | « document opaque » → **semi-opaque** : une tranche de régulation validée champ par champ, un reste stocké sans être lu. | La v1 se contredisait : `:20-22` disait « il ne l'interprète pas », `:55-61` le faisait lire `batches`, `recipes`, `devices`, `eid` et la marque de démonstration. |
| **§2.B** | La phrase « un appareil périmé ne peut plus imposer ses lots » est **retirée** et remplacée par la garde qui la rend vraie. | Fausse. Le plan n'est plus déposé, mais le document l'est, et le 409 compare des révisions, pas des contenus. Un téléphone de huit jours qui lit `rev: 83` puis écrit `base: 83` ressuscite un lot archivé et rallume la prise. |
| **§2.C** (nouveau) | Trois magasins : `donnees` (partagé, versionné), `mesures` (local), `decisions` (écrites par le pont). | `pontApplique` réécrit `d.recu`, `d.on`, `d.online`… à chaque synchronisation (`hakko-dashboard.html:1688-1711`), toutes les 15 s (`hakko-dashboard.html:2787`). Partager tout `S` ferait s'incrémenter `rev` en continu et mettrait chaque appareil en 409 permanent, sans aucun utilisateur. |
| **§3** | Taille **512 Kio** et non 2 Mio ; `client_max_body_size` exigé dans nginx ; `GET /api/donnees/rev` séparé ; fsync et copie précédente obligatoires ; **507** sur échec d'écriture ; `op` d'idempotence ; `donnees` nul/absent → 400 ; `/api/donnees` fermé quand `PONT_AUTH=aucune`. | 2 Mio est refusé par nginx avant le pont (`nginx.conf:74-82`, défaut 1 Mio) et impossible avec `CORPS_MAX = 4096` (`pont/pont.py:50`). Sans fsync (`pont/pont.py:399-405`), une coupure de courant vide la seule copie de la vérité. Sans code d'échec, un `rev` incrémenté avant un `os.replace` raté fait « adopter » le vide. |
| **§4** | Consigne prise dans la **copie figée** `lot.recipe`, pas dans `donnees.recipes` ; sonde `kind === "temp"` uniquement ; déduction spécifiée champ par champ ; dégradation **bornée** en cas d'illisibilité ; `exclus[]` dans `GET /api/regul`. | `:57` était une régression : le lot porte `recipe: snap('r1')` (`hakko-dashboard.html:794`) et supprimer une recette aurait arrêté une fermentation en cours. `h1` est une sonde d'humidité rattachée à `b3` et listée dans `PONT_SONDES`. Et `:63-65` gelait le plan sans échéance. |
| **§5** | Quatre gardes nommées (G1 sceau, G2 état ensemencé, G3 sauvegarde à l'adoption, G4 refus de `base: 0`). | La v1 plaçait la sauvegarde chez l'appareil qui pousse (`:71-72`) ; la perte a lieu chez celui qui adopte. Et un navigateur neuf réensemencé (`hakko-dashboard.html:829-830`) pouvait se proposer comme référence. |
| **§6** | « on avertit et on laisse choisir » (`:80-81`) → trois issues nommées, dont « garder les miennes » qui **ne réactive aucun lot** sans champ explicite. | C'était la porte de la résurrection : garder les siennes réécrivait un `status: "active"` périmé sur une prise réelle. |
| **§7** | Deux invariants ajoutés : l'état local volatil ne part jamais dans le document (liste close) ; l'élagage de quota ne touche jamais une clé partagée. | `save()` supprime `S.hist` et `S.eventsArchive` quand le quota est plein (`hakko-dashboard.html:841-849`) : partagé, le quota plein du PC effacerait l'historique du téléphone. |
| **§8** | Six épreuves ajoutées : deux ponts simultanés, 1 Mio nginx, coupure brutale, sceau, état ensemencé, résurrection, et l'épreuve du silence (zéro 409 en 30 min sans utilisateur). | Les trous trouvés sont tous dans des chemins qu'aucune des trois preuves de la v1 ne traverse. |
| **§9** | Les cinq questions sont **tranchées** ; la section devient le registre des décisions, et ce qui reste ouvert passe dans `avis-protocole-donnees.md` §5. | C'était la demande d'arbitrage. |

Sections conservées sans changement de fond : §1 (le problème), §2.A pour ce qui est de
l'emplacement du document, §7 invariants 1 à 5.

---

## 1. Le problème, mesuré

Les recettes, lots, appareils et le journal vivent dans le `localStorage` du navigateur
(clé `hakko-dashboard-v2`, `hakko-dashboard.html:762`, lue en `:829` et écrite en `:835`).
Le pont ne reçoit qu'un *plan de régulation* déposé par une page
(`POST /api/regul`, `pont/pont.py:908-956`).

Conséquence constatée : le PC supprime une recette, le téléphone l'affiche encore. Pire, le
téléphone qui ouvre le dashboard dépose **son** plan, contenant la recette supprimée — et le
pont chauffe pour un lot que le PC croit effacé. Le pont n'a rien fait de mal : la vérité est
en double.

---

## 2. Décision d'architecture

### A. Une seule vérité, côté pont, **semi-opaque**

Le pont conserve un document JSON dans `/data/donnees.json`, sur le volume persistant qui
existe déjà (`scada-opus-pont-etat`, `k8s/pvc-pont-etat.yaml`, monté sur `/data` par
`k8s/deployment.yaml:155-157`).

Il n'interprète que ce dont il a besoin pour réguler — la **tranche de régulation** définie au
§4 — et valide ces champs un par un, comme `valider_lot` le fait déjà
(`pont/pont.py:449-496`). Tout le reste (descriptions, ingrédients, étapes, notes, densités,
réglages d'affichage) est stocké tel quel, jamais lu, jamais validé, jamais réécrit.

Ce n'est pas un compromis : chaque champ que le pont comprend est un champ qu'il peut refuser à
tort, et chaque champ qu'il ignore est un champ qui pourrait commander une prise sans
contrôle. La frontière est donc explicite, et elle est le §4.

### B. Le plan n'est plus déposé, il est DÉDUIT

Le pont calcule lui-même le plan de régulation à partir des lots du document partagé. La page
cesse d'appeler `POST /api/regul` (§3, « ce qui disparaît »). La responsabilité de la page
devient : lire, éditer, écrire le document.

**Ce que cela supprime, exactement :** aucun appareil ne peut plus faire chauffer une prise
*sans écrire dans la vérité commune*. Le chemin d'imposition passe désormais par une écriture
visible, versionnée, et attribuable.

**Ce que cela ne supprime pas — et qu'il faut garder en tête :** un appareil périmé peut
toujours **écrire** un contenu périmé sous une révision fraîche. Il lui suffit de lire le
document courant puis de poster son ancien contenu avec le `base` qu'il vient de lire : la
révision concorde, le 409 ne se déclenche pas, et un lot archivé repasse `actif`. Le 409
protège la révision, pas le contenu. C'est la garde `maj` du §4.4 qui ferme ce chemin, et elle
est aussi obligatoire que le 409 lui-même.

### C. Trois magasins, pas un

| Magasin | Contenu | Écrivains | Arbitrage | Transport |
|---|---|---|---|---|
| **`donnees`** | `recettes`, `lots`, `appareils` (champs déclaratifs), `reglages` | les pages | révision globale, 409 strict | `GET`/`POST /api/donnees` |
| **`mesures`** | l'historique de mesures (`S.hist`) | la page locale | aucun — non partagé | `localStorage` seulement |
| **`decisions`** | ce que le pont a réellement commuté | **le pont seul** | aucun — append-only | `GET /api/decisions?depuis=` |

Pourquoi `mesures` sort du document : il est réécrit toutes les trois minutes par chaque
appareil (`hakko-dashboard.html:1021-1033`), il pèse l'essentiel des octets
(`HIST_MAX = 4320` points par lot, `hakko-dashboard.html:930`), et le partager mettrait les
deux appareils en conflit permanent. Effet secondaire voulu : une adoption n'efface plus les
courbes de l'appareil qui adopte.

Pourquoi `decisions` est un magasin à part, **écrit par le pont** : le §2.B promet qu'un lot
chauffe sans qu'aucune page soit ouverte. Or aujourd'hui les décisions vivent en mémoire,
plafonnées à 60 (`pont/pont.py:356`, remplies en `:533-547`), **absentes de ce que
`sauver_etat` écrit** (`pont/pont.py:392-398`), et lues seulement par une page ouverte
(`hakko-dashboard.html:1748-1770`). Le pont peut donc chauffer trois jours, redémarrer, et ne
laisser aucune trace de ce qu'il a commuté. Le pont écrit désormais ses décisions dans
`/data/decisions.jsonl`, une ligne JSON par décision, fichier tourné à 256 Kio avec une
génération conservée. `GET /api/decisions?depuis=<t>` les sert ; chaque page les fusionne en
**lecture seule** dans son journal.

Coût assumé : le PC ne verra pas les clics faits sur le téléphone dans « Activité récente ».
Il verra toutes les commutations réelles. Le journal d'interface est un confort, la trace des
relais est une obligation.

---

## 3. Endpoints (contrat)

Gardes communes, inchangées : `Content-Type: application/json` exigé sur POST (sinon 415),
corps invalide → 400, entité hors liste blanche → 403
(`pont/pont.py:885-907`, `:963-965`).

### Préalable d'installation — authentification

`GET` et `POST /api/donnees` ne sont servis que si `PONT_AUTH=jeton`. Sous
`PONT_AUTH=aucune` (valeur actuelle, `k8s/deployment.yaml:93-94`), les deux routes répondent
**503 `{ok: false, motif: "authentification"}`**, la page reste sur `localStorage` et l'annonce
à l'écran.

Raison : avec `/api/regul`, une écriture hostile était transitoire — la page redéposait son
plan dans les dix minutes (`hakko-dashboard.html:1777`). Avec un document persistant,
n'importe quelle machine du réseau écrit `rev+1`, et les pages légitimes, en suivant le §5 et
le §6, **adoptent**. Une écriture non authentifiée deviendrait la destruction définitive de
tous les relevés. Le commentaire de `k8s/deployment.yaml:85-92` assume ce risque pour les
prises ; il n'a pas été écrit pour des archives. La page sait déjà demander le jeton
(`hakko-dashboard.html:1797-1804`).

### Préalable d'installation — taille de corps

`nginx.conf`, `location /api/` (`nginx.conf:74-82`), doit déclarer :

```nginx
client_max_body_size 528k;   # 512 Kio de document + marge d'enveloppe
```

Sans cette ligne, le défaut nginx de 1 Mio refuse la requête **avant le pont**, avec une page
d'erreur HTML que `r.json()` ne sait pas lire — et le patron d'appel existant traite cela par
un `return false` muet (`hakko-dashboard.html:1781-1783`). L'écriture cesserait en silence.

Côté pont, `CORPS_MAX = 4096` (`pont/pont.py:50`) **reste la limite de `/api/prise`** ; la
limite de corps devient propre à chaque route.

### Taille maximale du document : 512 Kio

Et non 2 Mio. Quatre raisons cumulées :

- nginx plafonne à 1 Mio par défaut (`nginx.conf:74-82`) ;
- le pont est limité à 64 Mi de mémoire (`k8s/deployment.yaml:148-154`) et sérialise toute la
  réponse en mémoire (`pont/pont.py:788-803`) sur un serveur à threads
  (`pont/pont.py:1004-1006`) : quelques lectures concurrentes d'un document de 2 Mio tuent le
  pod, donc le régulateur ;
- le volume fait 8 Mi (`k8s/pvc-pont-etat.yaml:23`) et une écriture atomique avec copie
  précédente demande trois fois la taille du document ;
- avec `mesures` et le journal dehors (§2.C), 512 Kio est très large.

Dépassement → **413** `{ok: false, motif: "taille", octets_max: 524288}`.

### `GET /api/donnees/rev`

```json
{ "ok": true, "rev": 7, "maj": 1790962048, "semence": "k3f9…", "octets": 48213 }
```

Réponse courte, destinée au sondage. C'est **cette** route que la page appelle au rythme de sa
synchronisation (toutes les 15 s, `hakko-dashboard.html:2787`). Elle ne lit pas le document.

### `GET /api/donnees`

```json
{ "ok": true, "rev": 7, "maj": 1790962048, "semence": "k3f9…", "donnees": { … } }
```

Appelée **seulement** quand `rev` a changé. Le pont sert les octets stockés sans les analyser :
il ne les interprète pas pour les rendre (§2.A).

Document jamais écrit : `{ "ok": true, "rev": 0, "maj": 0, "semence": null, "donnees": null }`.

### `POST /api/donnees`

Corps : `{ "base": <rev lue>, "op": "<identifiant d'opération>", "donnees": <objet>,
"reactiver": ["<id de lot>", …] }`.

`reactiver` est facultatif, et n'autorise que ce qu'il nomme (§4.4).

- **`base == rev`** → écriture durable, puis `rev` incrémenté, puis
  `{ "ok": true, "rev": <nouveau>, "op": "<écho>", "avertissements": [ … ] }`.
  L'ordre est contractuel : `rev` ne change **qu'après** que l'écriture a réussi.
- **`base != rev`** → **409** `{ "ok": false, "motif": "revision", "rev": <courant>,
  "op": "<écho>", "donnees": <courant> }`.
- **`op` déjà vu et appliqué** → **200** avec la révision qu'il a produite, et non 409.
  Le pont retient les 16 derniers `op` appliqués, en mémoire et dans l'état. Sans cela, un POST
  qui aboutit mais dont la réponse est perdue au-delà du `proxy_read_timeout 20s` de
  `nginx.conf:81` est rejoué, reçoit un 409, et l'utilisateur se voit proposer d'adopter ce
  qu'il vient d'écrire.
- **`base` absent ou non entier** → 400.
- **`donnees` absent, `null`, ou non-objet** → 400 `{motif: "donnees"}`. Non spécifié en v1 :
  `donnees: null` aurait tout effacé.
- **clé racine inconnue** → 400 `{motif: "cle", cle: "<nom>"}`. Liste close : `recettes`,
  `lots`, `appareils`, `reglages`.
- **échec d'écriture** (`OSError`, volume plein, disque en lecture seule) → **507**
  `{ok: false, motif: "ecriture"}`, **`rev` inchangé**, document précédent intact. Le client
  garde son état et réessaie. C'est le code qui manquait : sans lui, un `rev` incrémenté avant
  un `os.replace` raté transforme la panne disque en perte de données.

### Durabilité de l'écriture

Dans cet ordre, sans exception :

1. le document courant est copié en `donnees.precedent.json` (une génération) ;
2. écriture du temporaire, `f.flush()`, `os.fsync(f.fileno())`, fermeture ;
3. `os.replace(tmp, donnees.json)` ;
4. `os.fsync()` du descripteur du répertoire `/data` ;
5. `rev` incrémenté, `semence.json` mis à jour (`rev_max`), réponse 200.

`pont/pont.py:399-405` ne fait aujourd'hui ni (1), ni (2), ni (4). C'est acceptable pour le
plan, que la page redépose toutes les dix minutes (`hakko-dashboard.html:1777`) ; c'est fatal
pour la seule copie de la vérité, où un `os.replace` durable dont les blocs ne le sont pas
donne un document tronqué.

### Verrou d'écriture

`rev` est **relu depuis le disque à chaque écriture**, sous un verrou pris par
`O_CREAT|O_EXCL` sur `/data/donnees.verrou` (considéré périmé après 30 s). Jamais depuis un
compteur en mémoire.

Raison : `k8s/deployment.yaml:17-21` déclare `RollingUpdate` / `maxUnavailable: 0` /
`maxSurge: 1` avec un PVC `ReadWriteOnce` (`k8s/pvc-pont-etat.yaml:19-20`) sur un nœud unique.
Deux pods montent donc le même `/data` pendant un déploiement, et les deux lancent
`regulation()` (`pont/pont.py:1004`). Avec un `rev` en mémoire, chaque processus a son
compteur : les deux acceptent `base == leur rev`, le second `os.replace` écrase le premier, et
**aucun 409 n'est émis**. La perte de mise à jour passerait par le seul chemin que le 409 ne
voit pas. Voir aussi l'invariant 8 du §7.

### Ce qui disparaît

`POST /api/regul` : supprimé du pont, supprimé des appels de la page
(`hakko-dashboard.html:1771-1787`). La route répond **410 Gone**, pas 404.

410 et non 404 parce qu'une page déjà ouverte tourne des jours (`hakko-dashboard.html:2787`)
et traite un échec de dépôt par un `return false` muet
(`hakko-dashboard.html:1781-1783`) : un 404 est indistinguable d'un incident passager, un 410
lui dit de se recharger.

Aucun chemin de secours en écriture n'est conservé. Le besoin derrière la question — que faire
quand le document est illisible ? — est traité au §4.5 par une dégradation bornée, pas par une
voie d'écriture : une porte ouverte « quand le document est illisible » rouvrirait le défaut
d'origine exactement au moment où personne ne peut vérifier ce que ce plan contredit.

`GET /api/regul` reste, en lecture seule, et renvoie le plan **déduit** avec sa provenance et
ses exclusions (§4.6).

---

## 4. Déduction du plan (pont)

À chaque tour (20 s, `PERIODE_REGULATION`, `pont/pont.py:355`), le pont relit le document — au
plus une fois par tour — et en tire le plan.

### 4.1 Champs lus, et eux seuls

C'est la frontière du §2.A. Le pont ne lit rien d'autre.

- `lots[]` : `id`, `nom`, `start`, `status`, `recipe` (copie figée), `recipeId`
- `appareils[]` : `id`, `eid`, `kind`, `batch`, `demo`
- `recettes[]` : **non lu pour la régulation** (voir 4.2)

### 4.2 Consigne, écart, fin : depuis la copie figée du lot

La consigne vient de **`lot.recipe.temp`**, la copie figée que le lot porte lui-même
(`recipe: snap('r1')`, `hakko-dashboard.html:794`, fonction `hakko-dashboard.html:791`), et
**jamais** de `donnees.recettes` par `recipeId`.

C'était la régression de la v1 (`protocole-donnees-partagees.md:57`). Deux conséquences
qu'elle aurait eues : éditer une recette aurait changé la consigne d'une fermentation en
cours ; supprimer une recette — le geste même qui a révélé le bug — aurait fait disparaître la
consigne, donc le lot du plan déduit, donc la chauffe d'un lot que l'utilisateur croit actif.
`recipeId` ne sert qu'à l'affichage.

La déduction reproduit, champ par champ, ce que la page calcule aujourd'hui
(`hakko-dashboard.html:1726-1746`). Toute divergence rend la migration silencieusement
différente du comportement observé :

| Champ du plan | Expression | Référence |
|---|---|---|
| `actif` | `lot.status === "active"` | `hakko-dashboard.html:1726` |
| `consigne` | `Number(lot.recipe.temp)`, fini | `hakko-dashboard.html:1733-1734` |
| `ecart` | `Math.abs(Number(lot.recipe.tol))` si fini, **sinon 0,2** | `hakko-dashboard.html:1744` |
| `fin` | `round(lot.start/1000 + lot.recipe.duration*86400)`, en **secondes**, si `duration` fini et > 0, sinon `null` | `hakko-dashboard.html:1736-1742`, validé en `pont/pont.py:474-480` |
| `prises` | appareils du lot, `kind === "plug"`, `eid` réel, `demo` absent | `hakko-dashboard.html:1728-1729` |
| `sonde` | appareil du lot, **`kind === "temp"`**, `eid` réel, `demo` absent | `hakko-dashboard.html:1730-1732` |

`ecart` : les tolérances par type de `TYPES` (`hakko-dashboard.html:743-746` — miso 4,0,
koji 2,5) ne servent **pas** à la régulation ; elles ne qualifient que l'affichage
(`hakko-dashboard.html:1124`). Un pont qui « déduirait l'hystérésis du type » élargirait un
miso à ±4 °C. Si 0,2 °C n'est pas la bonne valeur de procédé, c'est une autre discussion, et
elle ne se tranche pas en changeant la déduction.

### 4.3 Sonde : température seulement, et une seule

`kind === "temp"` exclusivement. `h1`, `kind:'hum'`, est rattachée à `b3`
(`hakko-dashboard.html:819`) et son `eid` figure dans `PONT_SONDES`
(`k8s/deployment.yaml:124`) : « l'appareil rattaché au lot » aurait pu la désigner. Le
garde-fou d'unité du pont (`pont/pont.py:663-668`) l'aurait rattrapée, mais en refusant de
réguler, et le motif serait resté enterré dans les décisions.

**Deux sondes de température sur un même lot → le lot est exclu du plan**, avec un motif, et
non « la première gagne ». Deux sondes qui lisent 3 °C d'écart décideraient sinon, par l'ordre
du tableau, si une résistance chauffe.

### 4.4 Garde `maj` : un lot archivé ne remonte pas tout seul

Chaque lot porte un `maj` **apposé par le pont** à l'écriture, jamais accepté du client. Le
pont conserve le dernier `maj` connu par identifiant de lot, dans `/data`.

Règle : **un lot `actif` dont le `maj` présenté est antérieur au `maj` déjà enregistré pour ce
même identifiant n'est pas réactivé.** Il est écrit (§3), mais exclu du plan déduit, avec un
avertissement dans la réponse et dans `GET /api/regul`.

La réactivation volontaire reste possible : le POST liste l'identifiant dans
`reactiver: ["b1"]`, et le pont la journalise dans `decisions.jsonl`.

C'est la garde qui rend vraie la promesse du §2.B. Le `maj` client n'est jamais une autorité :
un téléphone remis à la main ou une tablette dont la pile s'est vidée ferait sinon gagner son
lot de la semaine dernière, définitivement, sur un système qui commande des résistances. Le
`rev` global reste le seul arbitre des conflits ; `maj` ne fait qu'empêcher une résurrection.

### 4.5 Document illisible : dégradation bornée

Liste blanche d'abord, inchangée : `PONT_PRISES` / `PONT_SONDES`
(`k8s/deployment.yaml:121-124`). Un plan qui citerait une entité hors liste est refusé **pour
ce lot**, jamais pour le document (§4.6, et `pont/pont.py:463-467`).

En cas d'illisibilité du document — fichier tronqué, JSON invalide, volume en erreur :

1. **on conserve le plan précédent** et on l'écrit dans `decisions.jsonl`. Ne jamais couper une
   chauffe parce que le fichier est temporairement illisible.
2. On tente `donnees.precedent.json` (§3). S'il est lisible, on le sert en lecture avec un
   avertissement, et **toute écriture est refusée** (507) jusqu'à décision de l'exploitant :
   écrire par-dessus une restauration automatique ferait disparaître la cause.
3. **Au-delà de `DOCUMENT_ILLISIBLE_MAX = 10 min`, le pont cesse de repousser l'échéance de
   sécurité** (`pont/pont.py:709-712`), de sorte que le plafond de chauffe de 90 min
   (`k8s/deployment.yaml:106-107`) coupe de lui-même.

Le point 3 est l'ajout décisif : la v1 gelait le plan sans échéance
(`protocole-donnees-partagees.md:63-65`), de sorte qu'un lot archivé par l'utilisateur à
l'instant même où le fichier devient illisible aurait chauffé indéfiniment, sans qu'aucune page
puisse écrire pour le contredire. Le patron existe déjà dans le code, pour une mesure non
rafraîchie : `pont/pont.py:688-697`.

Dix minutes est une valeur posée par analogie avec la cadence de redépôt actuelle
(`hakko-dashboard.html:1777`), et non mesurée — contrairement aux constantes de fraîcheur du
pont, qui viennent d'observations sur le parc réel (`pont/pont.py:357-363`).

### 4.6 Ce qui est accepté à l'écriture mais refusé au plan

Le pont **n'est pas éditeur de sa propre vérité**. Il refuse à l'écriture uniquement ce qui est
structurellement instockable (§3 : non-objet, `donnees` nul, taille, clé inconnue).

Tout ce qui ne casse que la régulation est **écrit**, puis signalé :

| Situation | Écriture | Plan |
|---|---|---|
| lot actif sans sonde de température | acceptée | lot exclu |
| lot actif avec deux sondes de température | acceptée | lot exclu |
| prise hors `PONT_PRISES` | acceptée | lot exclu |
| sonde hors `PONT_SONDES` | acceptée | lot exclu |
| consigne hors de −10…120 °C (`pont/pont.py:457-458`) | acceptée | lot exclu |
| `fin` aberrante (`pont/pont.py:474-480`) | acceptée | lot exclu |
| `maj` antérieur sur un lot actif (§4.4) | acceptée | lot exclu |

Les motifs remontent dans `avertissements[]` du 200 et dans
`exclus: [{lot, motif}]` de `GET /api/regul`, avec `source: {rev, maj, lu}`.

Trois raisons de ne pas refuser l'écriture : refuser, c'est empêcher d'enregistrer un lot à
moitié configuré, donc faire perdre une saisie — on reconstruirait la perte de données qu'on
prétend corriger ; deux appareils de version différente auraient deux idées de ce qui est
écrivable ; et **le sens sûr est déjà l'exclusion** — exclure un lot du plan ne lance pas une
chauffe, elle l'arrête, par `couper_orphelines` (`pont/pont.py:576-586`).

---

## 5. Migration — c'est là que le risque de perte est le plus grand

### 5.1 La suite d'actions qui ne doit jamais arriver

Sept étapes, **un seul geste utilisateur**, quelques minutes de fenêtre.

1. Le PC utilise le dashboard depuis des mois : `hakko-dashboard-v2`
   (`hakko-dashboard.html:762`) porte ses recettes, ses lots, et les notes d'un miso suivi
   depuis 142 jours (`hakko-dashboard.html:798`).
2. Le volume du pont redevient vide : PVC réappliqué après suppression, nœud réinstallé,
   répertoire `local-path` effacé. `GET /api/donnees` répond `rev: 0`, `donnees: null`.
3. Le téléphone ouvre la page avec un `localStorage` vidé — éviction des données de site après
   sept jours sans visite sur Safari iOS, navigation privée, ou « effacer l'historique ».
   `hakko-dashboard.html:829-830` : `S` est nul, donc `S = seed()`
   (`hakko-dashboard.html:763-827`) : six recettes de démonstration, cinq lots dont quatre
   `status:'active'`, neuf appareils dont les `eid` sont **les vraies prises** de
   `k8s/deployment.yaml:122-124`. L'écran est normal ; rien ne dit que ce sont des données de
   maquette.
4. Le téléphone voit `rev: 0`, propose « faire de ces données la référence partagée »,
   l'utilisateur confirme. **C'est le seul geste.**
5. `POST base: 0` → le pont stocke le document de démonstration, `rev: 1`.
6. Le PC se synchronise, voit `rev: 1 > 0`, annonce « les données partagées remplacent les
   vôtres », adopte, `localStorage.setItem(STORE, …)` (`hakko-dashboard.html:835`). Les mois de
   relevés sont écrasés.
7. Le pont déduit son plan. Les prises de démonstration portent `demo: true`
   (`hakko-dashboard.html:820-822`) et sont exclues (§4.2) — jusqu'au premier geste de
   l'utilisateur sur une prise, où `delete d.demo` (`hakko-dashboard.html:2708`) fait tomber la
   marque. Le lot fictif « Saison du Nord #3 », consigne 24 °C, commande alors une prise
   réelle.

Perte : toutes les recettes, tous les lots, toutes les notes. **Pas** les mesures : `S.hist`
reste local (§2.C), le PC garde ses courbes. C'est le seul lot de consolation, et c'est un
argument de plus pour ce découpage.

La même suite s'écrit dans l'autre sens — PC réinstallé, téléphone à jour — et l'étape 6
détruit alors les données du téléphone. **Les gardes sont donc symétriques : aucune ne suppose
que le PC est l'appareil de référence.**

### 5.2 Les quatre gardes

Chacune suffirait à interrompre la suite. Les quatre sont exigées, parce qu'elles échouent dans
des circonstances différentes.

**G1 — le sceau d'installation (page ; bloque l'étape 6).**
Le pont crée à sa première écriture une `semence` aléatoire dans `/data/semence.json`, et la
renvoie dans toutes ses réponses (§3). La page conserve la dernière `semence` et le dernier
`rev` vus, sous une clé qu'elle n'effacera jamais. Si la page connaît une `semence` et que le
pont en annonce une autre — ou aucune — la page **n'entreprend plus rien automatiquement** :
ni dépôt, ni adoption. Bandeau : « le pont a perdu les données partagées (dernière révision
connue : 83, du 2 oct. 18:12). Restaurer depuis cet appareil ? », avec un bouton explicite.

**G2 — un état ensemencé ne se propose jamais comme référence (page ; bloque l'étape 4).**
La page marque l'état issu de `seed()` — un seul point d'appel,
`hakko-dashboard.html:830` — et la marque tombe à la première édition de l'utilisateur. Tant
qu'elle tient, le bouton « faire de ces données la référence » est **absent**, remplacé par :
« ce navigateur n'a pas de données à partager — attendez l'autre appareil, ou restaurez une
sauvegarde ».

**G3 — adopter sauvegarde, toujours (page ; rend l'étape 6 réversible).**
Avant tout `setItem(STORE, …)` d'adoption, la page écrit son état courant sous
`hakko-dashboard-v2-remplace-<ms>`, conserve trois générations, et propose l'export fichier
dans le bandeau. La v1 plaçait la sauvegarde chez l'appareil qui **pousse**
(`protocole-donnees-partagees.md:71-72`) ; la perte a lieu chez celui qui **adopte**.

**G4 — le pont refuse `base: 0` s'il a déjà détenu un document (pont ; bloque l'étape 5).**
`semence.json` porte `rev_max`. Sceau présent et `donnees.json` manquant ou illisible →
`POST base: 0` répond **409 `{motif: "semence"}`**, jamais une écriture. Déblocage par un geste
d'exploitant documenté dans `DEPLOIEMENT.md` (supprimer `semence.json`), jamais par une page.

**Limite de G4, à écrire noir sur blanc :** `semence.json` vit sur le même volume que
`donnees.json`. Si le volume entier est effacé — l'étape 2 — le sceau disparaît avec lui et G4
est muette exactement quand on en aurait besoin. G4 ne couvre que le document corrompu ou
supprimé sur un volume survivant. C'est pourquoi G1 et G2, qui vivent dans les navigateurs,
sont obligatoires et non souhaitables.

### 5.3 Parcours nominal de la première mise en service

Le pont démarre sans document (`rev: 0`, `semence: null`). Le **premier appareil** qui ouvre le
dashboard, **et dont l'état n'est pas ensemencé** (G2), propose de faire de ses données la
référence : confirmation explicite, copie de sauvegarde locale sous une clé distincte
(`hakko-dashboard-v2-sauvegarde`), export fichier proposé, puis `POST base: 0`. Le second
appareil, voyant `rev > 0`, **ne pousse pas** : il compare, sauvegarde d'abord (G3), annonce,
et adopte. Aucun écrasement silencieux, dans aucun sens.

### 5.4 Risque résiduel

Volume effacé **et** les deux navigateurs vidés : plus rien à restaurer, aucune garde logicielle
n'y change quoi que ce soit. La seule défense est un export que l'utilisateur a réellement
fait. D'où l'exigence : un bouton « Exporter » toujours atteignable, et l'export proposé dans
le bandeau après toute adoption et après tout 409.

---

## 6. Repli

Pont injoignable, ou page ouverte en `file://` (`PONT_LOCAL`, `hakko-dashboard.html:718`) : la
page retombe sur `localStorage` et le dit à l'écran (« hors ligne — vos modifications ne sont
pas partagées »).

Au retour du pont, trois issues, et trois seulement. La formule de la v1 — « on avertit et on
laisse choisir » (`protocole-donnees-partagees.md:80-81`) — était la porte de la résurrection.

1. **`rev` du pont inchangé depuis la dernière lecture** → la page dépose ses modifications
   normalement (`base` = ce `rev`).
2. **`rev` a changé, la page n'a rien modifié hors ligne** → elle adopte, après G3.
3. **`rev` a changé et la page a modifié hors ligne** → aucune action automatique. La page
   présente la divergence lot par lot, recette par recette, et propose :
   - *adopter* (après G3, la version locale étant conservée sous clé datée) ;
   - *garder les miennes*, qui écrit avec `base` = le `rev` courant — et dans ce cas
     **aucun lot ne repasse `actif`** : la garde `maj` du §4.4 les exclut du plan, et seuls les
     identifiants listés dans `reactiver` sont réactivés, après une confirmation qui les nomme ;
   - *exporter d'abord*.

On ne fusionne jamais. Une fusion devrait choisir entre « recette supprimée sur le PC » et
« recette éditée sur le téléphone » ; le défaut d'origine (§1) est précisément une suppression
qui ne s'est pas propagée, et une fusion qui garde les deux la ressuscite — sur une prise
électrique.

### Discipline d'écriture de la page

Trois règles, sans lesquelles le 409 strict est une source de pertes et non une protection.

- **Une seule écriture en vol.** `S` est un global muté partout
  (`hakko-dashboard.html:828`), sauvé par le `setInterval` de 3 s
  (`hakko-dashboard.html:2787`) **et** par chaque gestionnaire. File d'attente à une place,
  sinon deux POST de la même page portent le même `base` et le second se conflicte avec
  lui-même.
- **`base` ne se met à jour que depuis la réponse du pont.** Jamais depuis un compteur local.
- **Aucune adoption pendant une saisie.** Tant que `<dialog id="dlg">`
  (`hakko-dashboard.html:692`) est ouvert, l'adoption attend. Elle n'est jamais silencieuse.

Et dans tous les cas : **la version refusée est conservée**, sous
`hakko-dashboard-v2-refuse-<ms>`, trois générations, jamais écrasée, avec
« votre version du 3 oct. 14:12 a été refusée : comparer / réappliquer / exporter ». Sans cela,
« adopter » est un synonyme de « perdre ».

---

## 7. Invariants à ne pas casser

1. **Aucune dépendance nouvelle** : bibliothèque standard seulement côté pont, aucune
   compilation côté page, un fichier JSON.
2. La page doit **continuer de fonctionner ouverte en `file://`**, sans pont.
3. Le code de sûreté de la régulation est **inchangé** : liste blanche
   (`pont/pont.py:463-467`), frein d'une commande par minute (`pont/pont.py:551-556`), plafond
   de 90 min (`pont/pont.py:324-327`), coupure sur sonde muette
   (`pont/pont.py:671-679`), coupure sur mesure figée (`pont/pont.py:680-687`), balayage des
   prises non réclamées (`pont/pont.py:576-628`). Une passe qui y touche est refusée.
4. La page servie reste **l'octet pour octet** du fichier local (après normalisation LF).
5. Monorepo GitOps : la page et le pont sont **deux images distinctes** ; ne pas croiser les
   responsabilités.
6. **L'état local volatil ne part jamais dans le document partagé.** Liste close des champs qui
   restent locaux à chaque navigateur :
   - sur un appareil : `online`, `on`, `value`, `battery`, `recu`, `seen`, `cmdT`, `origine`,
     `origineT`, `regulPause`, `regulRefus`, `regulDepuis`, `power` ;
   - à la racine : `hist`, `events`, `eventsArchive`, `prisesInconnues`, `stockageAlerte`,
     `heatSeeded`, `stripSeeded`, `migrationSim`.

   Ce qui est partagé d'un appareil, et rien d'autre : `id`, `eid`, `name`, `kind`, `batch`,
   `mode`, `slot`, `demo`.

   Raison : `pontApplique` réécrit ces champs à **chaque** synchronisation
   (`hakko-dashboard.html:1688-1711`, `:1696-1697`), soit toutes les 15 s
   (`hakko-dashboard.html:2787`), et `fraiche()` (`hakko-dashboard.html:910-916`) comme
   `surveillance()` (`hakko-dashboard.html:2329-2353`) en dépendent. Les partager ferait
   s'incrémenter `rev` en continu et mettrait chaque appareil en 409 permanent, sans aucun
   utilisateur. Une prise sans `eid` garde son état `on` localement : elle ne commande rien.
7. **L'élagage de quota ne touche jamais une clé partagée.** `save()` supprime `S.hist` et vide
   `S.eventsArchive` quand le `localStorage` est plein (`hakko-dashboard.html:841-849`) : ces
   clés étant locales (invariant 6), l'élagage reste local. Il ne doit en aucun cas s'étendre à
   `recettes`, `lots` ou `appareils` — le quota plein du PC effacerait les données du téléphone.
8. **Un seul pont écrit à la fois.** `strategy: Recreate` sur `k8s/deployment.yaml:17-21`
   **et** le verrou de fichier du §3. Les deux : `Recreate` supprime la fenêtre à deux
   régulateurs — qui existe déjà aujourd'hui — au prix de quelques secondes
   d'indisponibilité, déjà acceptées au `k8s/deployment.yaml:14-15` ; le verrou survit à un
   retour en arrière du manifeste.
9. **`client_max_body_size` déclaré** dans `location /api/` (`nginx.conf:74-82`). Un défaut
   implicite plus petit que la limite annoncée fait échouer les écritures en silence.

---

## 8. Définition de « fini »

Tests unitaires du pont sur le protocole : révision, 409, idempotence par `op`, taille,
illisibilité, 507 sur échec d'écriture, garde `maj`, sceau.

Preuves par exécution — chacune vise un trou trouvé, pas une fonctionnalité :

1. **Deux navigateurs.** A écrit, B voit. B écrit sur une révision périmée → 409 → B conserve
   sa version sous clé datée, la montre, et adopte sans écraser. Pont coupé → la page
   fonctionne et le dit.
2. **Plan déduit.** Un lot rendu actif dans le document partagé chauffe **sans qu'aucune page
   ne soit ouverte** ; un lot archivé coupe.
3. **Résurrection.** Une copie du document vieille d'une semaine, contenant un lot `actif`
   archivé depuis, est écrite avec le `base` courant : le lot est stocké et **n'est pas** dans
   le plan déduit ; `GET /api/regul` le nomme dans `exclus`. Puis le même POST avec
   `reactiver: ["b1"]` le réactive, et `decisions.jsonl` en porte la trace.
4. **Deux ponts.** Deux processus pont sur le même `/data` : cinquante écritures concurrentes,
   aucune perte de mise à jour, `rev` strictement croissant, et chaque perdant reçoit un 409.
5. **1 Mio.** Un document de 600 Kio est refusé par le pont en 413 avec un motif lisible — et
   non par nginx avec du HTML que la page ne sait pas lire.
6. **Coupure brutale.** `kill -9` du pont pendant une écriture, dix fois : à chaque reprise,
   soit l'ancien document, soit le nouveau, jamais un document tronqué. Puis `donnees.json`
   tronqué à la main : le pont sert `donnees.precedent.json` en lecture, refuse toute écriture
   en 507, garde le plan, et cesse de repousser l'échéance au bout de dix minutes.
7. **Sceau.** `/data` vidé pendant que les deux navigateurs ont des données : aucun des deux
   n'adopte, aucun ne pousse automatiquement, les deux affichent le bandeau et proposent la
   restauration explicite.
8. **État ensemencé.** Navigateur neuf (`localStorage` vidé) face à un pont `rev: 0` : aucun
   bouton ne propose d'en faire la référence.
9. **Le silence.** Deux appareils ouverts trente minutes, aucun geste utilisateur :
   **zéro 409, zéro incrément de `rev`.** C'est l'épreuve qui valide l'invariant 6, et c'est
   celle qui manque le plus à la v1.
10. **Authentification.** Avec `PONT_AUTH=aucune`, `/api/donnees` répond 503 et la page le dit
    à l'écran. Avec `jeton`, un appel sans en-tête `Authorization` répond 401.

---

## 9. Décisions (registre des arbitrages)

Les cinq questions de la v1 sont tranchées. Le raisonnement complet est dans
`design/avis-protocole-donnees.md` §2.

1. **Document opaque unique ou clés séparées ? Et le journal ?**
   → **Semi-opaque** : tranche de régulation validée champ par champ (§4.1), reste stocké sans
   être lu. **Trois magasins** (§2.C) : l'historique de mesures sort du document (réécrit
   toutes les trois minutes, l'essentiel des octets, conflit permanent sinon) ; le journal sort
   aussi, et les commutations réelles deviennent un magasin append-only **écrit par le pont**,
   parce qu'aujourd'hui elles n'existent qu'en mémoire, plafonnées à 60
   (`pont/pont.py:356`), absentes de `sauver_etat` (`pont/pont.py:392-398`), et lues seulement
   par une page ouverte — ce qui vide la promesse du §2.B de sa trace.

2. **Qui gagne entre deux écritures rapprochées ?**
   → **409 strict conservé**, mais « le perdant adopte » est refusé. Trois ajouts
   obligatoires : version refusée conservée sous clé datée, une seule écriture en vol avec
   `base` issu du pont et aucune adoption pendant une saisie (§6), et `op` d'idempotence (§3).
   Pas de fusion : elle devrait choisir entre une suppression et une édition, et le défaut
   d'origine est précisément une suppression qui ne s'est pas propagée.

3. **Le pont refuse-t-il un document qui casserait la régulation ?**
   → **Il l'accepte, refuse le plan, et le dit** (§4.6). Refuser l'écriture ferait perdre une
   saisie — on reconstruirait la perte qu'on prétend corriger — et ferait du pont l'éditeur de
   sa propre vérité. Le sens sûr est déjà l'exclusion : elle coupe la chauffe
   (`pont/pont.py:576-586`), elle ne la lance pas. Seule exception, inchangée : une prise hors
   liste blanche est refusée dans le plan, jamais dans le document.

4. **Garder `POST /api/regul` en secours ?**
   → **Non. Supprimé, 410 Gone** (§3). Le chemin de secours *est* le défaut : il s'ouvrirait
   précisément quand personne ne peut vérifier ce que le plan déposé contredit. Le besoin réel
   est couvert par la dégradation bornée du §4.5. 410 et non 404 parce qu'une page ouverte des
   jours traite un 404 comme un incident passager.

5. **Horodatage par lot plutôt que révision globale ?**
   → **Non pour l'arbitrage, oui comme champ non faisant autorité** (§4.4). Le `rev` global
   reste le seul arbitre : il est insensible à une horloge fausse, qu'un horodatage client ne
   serait pas. `maj`, apposé par le pont, sert à une seule chose : empêcher qu'un lot archivé
   repasse `actif` tout seul. C'est exactement le trou que le 409 ne voit pas — le contenu
   périmé sous une révision fraîche.

**Ce qui reste ouvert** — et qui n'est pas tranché ici : `design/avis-protocole-donnees.md` §5
(partage de l'historique de mesures, autorité entre `Recreate` et le verrou de fichier, valeur
de `DOCUMENT_ILLISIBLE_MAX`, bascule de `PONT_AUTH`, valeur de procédé de l'écart, sort des
`demo: true` déjà persistés).
