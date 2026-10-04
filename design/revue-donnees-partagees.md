# Revue de sûreté — passe « données partagées et plan déduit »

Lecture différentielle `design/pont-avant-donnees.py` → `scada-opus-5.5/pont/pont.py` et
`design/dashboard-avant-donnees.html` → `scada-opus-5.5/hakko-dashboard.html`, contre le
contrat `design/protocole-donnees-partagees-v2.md`. Date : 2026-10-03.
Aucune modification de code faite. Trois défauts sont confirmés **par exécution**, pas par
lecture.

---

## Verdict

**BLOQUANT.** Trois raisons, chacune suffisante :

1. La garde `maj` du §4.4 — la garde centrale de la passe — **ne voit pas un lot supprimé**.
   Un appareil périmé qui rejoue son vieux document rallume la prise réelle, sans un seul
   avertissement. Reproduit (D1).
2. Quand le plan déduit est vide, `GET /api/regul` renvoie `regule: false`, et **la page
   redevient le régulateur** : elle commande les prises elle-même pendant que
   `couper_orphelines` les coupe toutes les 20 s. Tout lot *exclu* du plan — y compris un lot
   mis en quarantaine par la garde `maj` — est donc chauffé par le navigateur (D4).
3. Dans la configuration réellement déployée (`PONT_AUTH=aucune`), `/api/donnees` répond 503 :
   **aucune page ne peut écrire le document**, donc le plan déduit est vide en permanence et
   le pont ne régule plus rien. Combiné à D4, la régulation retombe entièrement dans le
   navigateur — exactement ce que le pont existe pour éviter (D6).

Les freins, eux, sont intacts : vérifié par comparaison de corps de fonctions, pas sur parole.

---

## 1. Inventaire des fonctions du pont

**Premier fait de sûreté : aucune fonction supprimée.** Les 31 définitions de
`pont-avant-donnees.py` sont toutes présentes dans `pont.py` (comparaison par corps de
fonction, blancs de fin normalisés — pas par lecture du diff).

### Identiques, octet pour octet (24)

`liste`, `sans_port_defaut`, `class Config`, `appel_ha`, `raison`, `nombre`, `etat_appareils`,
`fiche`, **`commander`**, `age_mesure`, `sauver_etat`, **`charger_etat`**, **`valider_lot`**,
**`lire_sonde`**, `etat_prise`, **`commander_regule`**, **`couper_orphelines`**,
**`regulation`**, **`surveillance`**, `class Handler`, `autentifie`, `meme_origine`,
`journal`, `log_message`.

> `commander` et `charger_etat` apparaissent « modifiées » dans un diff textuel : seul le bloc
> de commentaires module **qui les suit** a changé. Leurs corps sont identiques.

Les six freins nommés dans le brief — `couper_orphelines`, `surveillance`, `valider_lot`,
`commander_regule`, `lire_sonde`, plus `commander` qui arme l'échéance de chauffe — sont tous
dans cette liste.

### Modifiées (9)

| Fonction | Sens | Ce qui change |
|---|---|---|
| `Config.__init__` (`pont.py:111`) | **neutre** | ajoute `self.rep_donnees`, déduit de `PONT_ETAT` si `PONT_DONNEES` est vide. |
| `Config.verifier` (`pont.py:157`) | **resserrement** | refuse de démarrer si `rep_donnees` n'est pas un répertoire : annoncer un magasin qui n'existe pas serait pire que pas de magasin. |
| `noter` (`pont.py:1382`) | **resserrement** | la décision part aussi dans `decisions.jsonl`, avec `fsync` par ligne. La trace survit au redémarrage — c'était la promesse non tenue du §2.B. |
| `boucle_regulation` (`pont.py:1485`) | **resserrement** | `rafraichir_plan()` en tête de tour : le plan est relu de la vérité à chaque tour, donc un lot archivé cesse de chauffer sans qu'aucune page intervienne. C'est le cœur utile de la passe. |
| `tour_lot` (`pont.py:1512`) | **resserrement incomplet** | `elif alumees and not echeance_gelee()` : on cesse de repousser l'échéance quand le document est illisible depuis 10 min. Vrai resserrement, mais il ne borne pas la chauffe (D2). |
| `Handler.repond` (`pont.py:1652`) | **neutre** | refactorisation : l'envoi part dans `envoyer()`, partagé avec `repond_octets()`. |
| `Handler.do_GET` (`pont.py:1844`) | **resserrement** | `/api/donnees`, `/api/donnees/rev`, `/api/decisions` ajoutés, tous derrière `meme_origine` **puis** `magasin_ouvert` **puis** `autentifie`. `/api/regul` gagne `exclus[]` et `source{}`. |
| `Handler.do_POST` (`pont.py:1929`) | **resserrement** | `POST /api/regul` → **410**, répondu *avant* la garde d'authentification (une page sans jeton doit apprendre que la route a disparu, pas recevoir un 401). Limite de corps propre à chaque route ; `CORPS_MAX` reste celle de `/api/prise`. |
| `main` (`pont.py:2017`) | **neutre** | journaux de démarrage : magasin, sceau, et avertissement si `PONT_AUTH != jeton`. |

### Nouvelles (31)

Durabilité et verrou : `magasin_present`, `_ch`, `_fsync_repertoire`, `_ecrire_durable`,
`verrou_fichier`.
Magasin `donnees` : `_enveloppe`, `lire_enveloppe`, `lire_precedent`, `lire_sceau`,
`ecrire_sceau`, `lire_meta`, `ecrire_meta`, `ecrire_donnees`, `_ecrire_verrouille`,
`_sans_maj`, `_apposer_maj`.
Magasin `decisions` : `noter_fichier`, `decisions_depuis`, `noter_protocole`.
Déduction : `_appareils_du_lot`, `_ecarter`, `deduire_plan`, `echeance_gelee`,
`_plan_degrade`, `rafraichir_plan`.
HTTP : `repond_octets`, `envoyer`, `magasin_ouvert`, `parametre_depuis`, `donnees_lire`,
`donnees_ecrire`.

### Côté page

Supprimée : `planRegulation()` — la page ne construit plus de plan. Remplacée par
`projectionPartagee()` / `pontSynchroDonnees()`. `pontPoussePlan()` est conservée comme coquille
qui délègue (et son nom ment désormais : C2).
Nouvelles : `sauvegarderLocal`, `lireSceau`, `ecrireSceau`, `etatEnsemence`, `marquerEdite`,
`adopterDocument`, `pontLireRev`, `pontEcrireDonnees`, `pontSynchroDonnees`,
`signaturePartagee`, `projectionPartagee`, `sauvegardesConservees`, `bandeauPartage`.
Les fonctions de régulation de la page (`regulerPont`, `regulerSecurite`, `couperSansMesure`,
`regulMaitre`) sont **inchangées** — et c'est précisément le problème D4.

---

## 2. Défauts

| # | Gravité | Fichier:ligne | Ce qui se passe | Correction proposée |
|---|---|---|---|---|
| **D1** | **bloquant** | `pont.py:1226-1230`, `1101-1125` | **CONFIRMÉ PAR EXÉCUTION.** La garde `maj` ne voit pas un lot **supprimé**. `anciens` est construit uniquement depuis les lots du document courant (`:1228`) ; un lot effacé n'a plus de `maj` connu, donc `maj_connu is None`, donc `resurrection` est faux (`:1122`). Témoin (lot *archivé* rejoué) : `exclus: ['b1']`, prise coupée, deux avertissements. Sonde (lot *supprimé* rejoué) : `lots_au_plan: ['b1']`, `exclus: []`, `avertissements: []`, **prise rallumée**. C'est le défaut du §1 — une suppression qui ne se propage pas — reconstruit à l'identique, sur une résistance. | Persister le dernier `maj` **par identifiant de lot** dans `donnees-meta.json`, à côté de la quarantaine, et le conserver après suppression du lot. Le contrat l'exige mot pour mot (§4.4 : « le pont conserve le dernier `maj` connu par identifiant de lot, **dans `/data`** ») ; le code a choisi l'inverse et le docstring de `lire_meta` (`pont.py:740-741`) en fait un argument. Plafonner comme `QUARANTAINE_MAX`. |
| **D2** | **bloquant** | `pont.py:1560-1566` + `374-379` | `echeance_gelee()` empêche de **repousser** l'échéance, pas de **rallumer**. Document illisible : `surveillance` coupe au plafond de 90 min, la température retombe sous `c - h`, le tour suivant repasse par `v < c - h and not alumees` → `commander_regule(..., True, …)` → `commander` **réarme** `_echeances` à +90 min (`:377`). La chauffe redevient indéfinie, par cycles. Le §4.5 point 3 promet que « le plafond de chauffe coupe de lui-même » : il ne coupe qu'une fois, puis tout repart. Le même trou vaut pour la branche « mesure non rafraîchie » (`:1549-1558`), où il est **préexistant**. | Quand `echeance_gelee()` est vrai, **refuser l'allumage** : garder les branches de coupure, ajouter en tête de la décision de chauffe un test qui écarte l'allumage et le journalise une fois. Le sens sûr est de ne plus rien lancer sur un plan que personne ne peut contredire. |
| **D4** | **bloquant** | `hakko-dashboard.html:1083`, `1104`, `1961` | `PONT.regule = j.regule && lots.some(actif)` ; `maitreRegul = PONT.actif && !PONT.regule && regulMaitre()` ; puis `regulerPont(d, b, tp, voulu)` **commande la prise depuis le navigateur**. Donc dès que le plan déduit est vide, la page régule. Or le §4.6 crée tout un jeu de causes d'exclusion neuves (quarantaine `maj`, deux sondes de température, copie figée absente, prise hors liste blanche) dont il affirme que « l'exclusion ARRÊTE la chauffe ». Elle ne l'arrête que côté pont : `couper_orphelines` coupe toutes les 20 s, la page rallume sous `AUTO_COOLDOWN = 60 s`. Résultat concret : un lot mis en quarantaine *parce qu'il était une résurrection* est chauffé par le navigateur, et le relais bat. La garde `maj` est donc annulée par la page même quand elle fonctionne. | Rendre `regule` indépendant du nombre de lots : le pont régule dès qu'il est joignable et qu'il a un document. Concrètement, faire porter à `GET /api/regul` un champ explicite (p. ex. `"autorite": true` quand `magasin_present()` et que le document est lisible) et faire de **ce** champ, et non de `lots.some(actif)`, la condition qui coupe la régulation locale. Puis vérifier que la page affiche `exclus[]` : un lot qui ne chauffe pas doit le dire à l'écran, puisqu'elle ne le chauffera plus. |
| **D6** | **bloquant (mise en service)** | `k8s/deployment.yaml:93-94`, `nginx.conf:74-82`, `k8s/deployment.yaml:17-21` | Trois préalables d'installation du contrat ne sont **pas faits** — ces deux fichiers ne sont pas touchés par la passe (`git status`). (a) `PONT_AUTH=aucune` → `magasin_ouvert()` est faux → `/api/donnees` répond 503 en GET **et** en POST : aucune page ne peut écrire le document, le plan déduit reste vide pour toujours, et le pont ne régule plus **rien**. Avec D4, toute la régulation retombe dans le navigateur. (b) `client_max_body_size` absent de `location /api/` : invariant 9 du §7 non tenu. (c) `strategy: RollingUpdate / maxUnavailable: 0 / maxSurge: 1` inchangé : l'invariant 8 exige `Recreate` **et** le verrou ; seul le verrou est là. | Avant tout déploiement : basculer `PONT_AUTH` sur `jeton`, déclarer `client_max_body_size 528k`, passer `strategy` à `Recreate`. Tant que (a) tient, **ne pas déployer cette passe** : elle retire `POST /api/regul` sans rien mettre à la place qui soit joignable. |
| **D3** | à corriger | `pont.py:1738-1755`, `hakko-dashboard.html:1826-1836` | En mode dégradé, `/api/donnees` et `/api/donnees/rev` servent la génération précédente **avec son propre `rev`** : la révision **recule** (8 → 7). La page ne lit jamais le champ `degrade` (`grep degrade` sur la page : aucune occurrence). Elle voit donc `tete.rev !== PONT.rev`, télécharge, et si elle n'a rien modifié depuis sa dernière écriture elle **adopte** — silencieusement, une révision plus vieille que la sienne — tandis que toute écriture est refusée en 507. Au retour à la normale, elle réadopte la révision 8 : le contenu de la 8 a été remplacé par celui de la 7 dans les deux navigateurs entre-temps. | Côté pont : servir la génération précédente sous un champ distinct (`rev_precedent`), en gardant `rev` à la dernière valeur connue, ou faire de `degrade` un drapeau du sondage. Côté page : si `tete.degrade` est vrai → **gel** (ni dépôt, ni adoption) et bandeau, exactement comme G1. |
| **D5** | à corriger | `pont.py:1160`, `hakko-dashboard.html:1679`, `1908-1918` | **CONFIRMÉ PAR EXÉCUTION.** Le pont appose `maj` sur chaque lot (`:1160`) ; la page compare `signaturePartagee()` (sans `maj`) à `JSON.stringify(j.donnees)` (avec). Sonde : champs envoyés `[id,name,recipe,recipeId,start,status]`, champs rendus `[id,maj,name,…]` → égalité impossible. Conséquence : **à chaque rechargement**, l'appareil qui a écrit en dernier passe par la branche `PONT.rev === null`, échoue à la comparaison, et affiche « les données du pont diffèrent de celles de cet appareil, qui a été modifié hors ligne » — faux. Pire, `PONT.divergence` étant posé, `:1945` (`… && !PONT.divergence`) **bloque toutes les écritures suivantes** jusqu'au clic. Récidive après chaque nouveau lot. Et c'est un entraînement à cliquer « Adopter » sur une fausse alerte. | Comparer sur une projection normalisée des deux côtés : côté page, retirer `maj` des lots avant de signer (et avant de comparer au document rendu), ou mieux, comparer `signaturePartagee()` au document rendu **dépouillé de `maj`**. Documenter que `maj` est un champ du pont, non signé. |
| **D7** | à corriger | `hakko-dashboard.html:1795`, `2990`, `3005`, `3075`, `3094` | `marquerEdite()` n'est appelé que sur 4 gestes : supprimer un lot, lancer une fermentation, ajouter un appareil, enregistrer une recette. Il **manque** sur : archiver/terminer un lot (`:2968`), rattacher un appareil à un lot et changer son mode (`:3038-3039` — les deux `delete d.demo`, soit le geste même du §5.1 étape 7), ajouter une densité, ajouter une note, supprimer/archiver une recette. Un état réellement édité reste donc `ensemence: true`, avec **deux** conséquences opposées et toutes deux fausses : (a) `pontSynchroDonnees` l'adopte **automatiquement**, sans confirmation (`:1911`), écrasant le travail de l'utilisateur ; (b) G2 refuse le partage avec le message « ce navigateur n'a pas de données à partager (recettes de démonstration) », sans issue. | Ne pas énumérer les gestes : faire tomber la marque **dans `save()`**, ou dans un point de passage unique des mutations de `S.recipes`/`S.batches`/`S.devices`. Une liste de sites d'appel est condamnée à dériver — c'est déjà fait. |
| **D8** | à corriger | `hakko-dashboard.html:1770-1778`, `1801`, `1818-1821` | `adopterDocument()` appelle `sauvegarderLocal()`, puis **adopte quoi qu'il arrive** : si le quota est plein, `sauvegarderLocal` renvoie `null` et l'adoption se poursuit, en se contentant d'un `logEvent` « (sauvegarde locale impossible : stockage plein) ». G3 — « adopter sauvegarde, toujours » — échoue donc exactement dans le cas où elle sert : stockage saturé, c'est-à-dire beaucoup de données à perdre. | Si la sauvegarde échoue : refuser l'adoption automatique, poser `PONT.divergence` avec un motif « sauvegarde impossible », et exiger un export avant d'adopter. Dans le chemin manuel (`data-action="adopter"`), le dire dans le `confirm()` au lieu de promettre « votre version est conservée ». |
| **D9** | à corriger | `hakko-dashboard.html:1929-1931` vs `1904-1918` | « Aucune adoption pendant une saisie » (§6) n'est appliqué que dans la branche « un autre appareil a écrit » (`if (dlg && dlg.open) return;`). La branche de première lecture (`PONT.rev === null`) peut adopter automatiquement **sans** ce test. Au chargement, c'est peu probable ; après une perte de réseau prolongée qui a remis `PONT.rev` à… non, `PONT.rev` n'est jamais remis à `null` en cours de session — donc le risque réel est un dialogue ouvert très tôt. Reste une incohérence à fermer, à une ligne. | Déplacer le test `dlg.open` en tête de `pontSynchroDonnees`, après la lecture de `rev`. |
| C1 | cosmétique (commentaire faux) | `pont.py:740-741` | « Le dernier « maj » connu de chaque lot, lui, n'est **PAS** ici : il est dans le document lui-même, donc indissociable de sa révision. » Le commentaire présente comme un avantage ce qui **est la cause de D1**, et contredit le §4.4. La prochaine lecture conclura que la garde est complète. | Réécrire après correction de D1, ou, si le choix est maintenu, dire explicitement « conséquence : un lot supprimé perd son `maj` et peut être réactivé sans garde ». |
| C2 | cosmétique | `hakko-dashboard.html:1978` | `pontPoussePlan()` ne pousse plus aucun plan : elle appelle `pontSynchroDonnees()` et renvoie `PONT.partage`. Le commentaire le dit, le nom non — et c'est le nom qu'on lit à l'appel (`:2008`). | Renommer `pontSynchroPartage()`. |
| C3 | cosmétique | `hakko-dashboard.html:2282-2287`, `2941-2954` | Le bandeau « votre version du … a été refusée » reste affiché **pour toujours** : `reappliquer` ne supprime pas les clés `hakko-dashboard-v2-refuse-*`. Après une réapplication, l'utilisateur relit indéfiniment un avertissement résolu. | Supprimer la clé réappliquée (en gardant les autres générations), ou marquer la clé comme traitée. |
| C4 | cosmétique (écart au contrat) | `pont.py:937` | `debut = nombre(brut.get("start")) or time.time() * 1000.0`. Le §4.2 spécifie `fin` depuis `lot.start` ; la page renvoie `null` quand `start` manque (`Number(undefined)` → `NaN`). Le pont, lui, donne `fin = maintenant + duree`. Le sens est plus sûr (une échéance au lieu d'aucune), mais c'est un écart non documenté — et `start: 0` tombe dans le même `or`. | Documenter le choix dans le commentaire, et distinguer `start` absent (fin = maintenant + durée) de `start: 0` (lot exclu : un horodatage nul est une donnée cassée). |
| C5 | cosmétique | `hakko-dashboard.html:1673`, `1816` | `reglages` est envoyé à chaque écriture (`S.reglages || {}`) et adopté, mais **rien** ne l'écrit jamais dans la page. Clé morte dans la liste close du §3. | Soit la retirer de `CLES_RACINE` et de la projection, soit l'employer. Une clé partagée que personne n'écrit finira par être écrite par erreur. |
| C6 | cosmétique (fragilité) | `pont.py:659`, `678` | `lire_enveloppe` renvoie `dict(_doc_cache)` : copie **superficielle**. `enveloppe["document"]` est le même objet que le cache. Aucun appelant ne le mute aujourd'hui — mais `_apposer_maj` mute son argument (`:1160`), et il est à une ligne de distance de recevoir celui-là. Une mutation empoisonnerait le cache sans changer le fichier. | Renvoyer le document sous `copy.deepcopy`, ou documenter « lecture seule » à l'endroit du `return`. |
| C7 | cosmétique (message faux) | `pont.py:1173`, `hakko-dashboard.html:1894` | Un **verrou occupé** (autre pont en train d'écrire pendant un déploiement) renvoie 507 `motif: "verrou"`, et la page annonce « son stockage est plein ou en lecture seule ». Le message envoie chercher la panne sur le volume. | Distinguer `motif` dans le message de la page : « verrou » → « un autre pont écrit, nouvelle tentative » ; « illisible » → « document endommagé, écritures suspendues ». |

---

## 3. Ce que j'ai vérifié et trouvé CORRECT

### Les freins (invariant 3 du §7) — intacts

- **Liste blanche** : `valider_lot` identique (`pont.py:1298-1347`), et `deduire_plan` ne la
  contourne pas : il **passe par** `valider_lot` (`pont.py:969-981`). Un lot citant une prise
  hors `PONT_PRISES` est écarté avec le motif de `valider_lot`, inchangé.
  `POST /api/prise` garde son `entite not in CFG.prises` → 403 (`pont.py:1996`).
- **Frein d'une commande par minute et par prise** : `commander_regule` identique
  (`pont.py:1409-1411`).
- **Plafond de chauffe 90 min** : `commander` (`pont.py:374-379`) et `surveillance`
  (`pont.py:1595-1642`) identiques. `charger_etat` reconstruit les échéances depuis l'heure de
  la dernière commande, sans les remettre à zéro (`pont.py:492-495`) : un redémarrage ne
  prolonge pas une chauffe.
- **Coupure sur sonde muette (15 min)** et **sur mesure figée (1 h)** : `tour_lot:1531-1548`,
  `FRAICHEUR_TOLEREE = 3600` inchangé. Seule la branche « on continue de chauffer » a changé.
- **`couper_orphelines`** : identique (`pont.py:1431-1482`), toujours appelé **avant** les
  tours de lot (`pont.py:1502`), avec l'ensemble des prises réclamées par les lots actifs. La
  règle 5 du propriétaire — une prise non liée est affichée et réellement éteinte — tient
  côté pont : `a_examiner = set(CFG.prises) | set(_allumees_par_pont)`.

### Chemins « prise allumée sans surveillance » qui se referment bien

- **Volume vidé en cours de service** : `lire_enveloppe` renvoie `None` sur
  `FileNotFoundError` (`:654`), `rafraichir_plan` prend `document = {}` (`:1034`),
  `deduire_plan` renvoie un plan vide, `couper_orphelines` coupe tout. La disparition de la
  vérité éteint, elle n'allume pas.
- **Document sans `lots`, `lots` non-liste, lot non-objet, `id` vide** : écartés ou ignorés →
  plan vide → extinction (`:896-908`).
- **Magasin absent** : `rafraichir_plan` sort tout de suite (`:1027`), donc le plan ne serait
  jamais relu. Mais `magasin_present()` est faux **si et seulement si** `CFG.etat` est vide
  (`:145-151`), auquel cas `charger_etat` sort aussi (`:465`) : il n'y a pas de plan fossile à
  ressusciter. Vérifié, pas supposé.
- **Pont redémarré** : `charger_etat` relit le plan **et** les échéances, puis le premier tour
  le remplace par le plan déduit du document. Aucune fenêtre où un plan périmé survive à la
  première relecture du document (20 s).
- **409 et 507** : ni l'un ni l'autre ne touche `_plan`. Un conflit de révision ou un disque
  plein laisse le plan précédent, qui reste relu du document réellement stocké.
- **`reactiver`** : n'autorise que ce qu'il nomme, aucun drapeau global (`:1808-1814`),
  plafonné à 64, et la levée est journalisée dans `decisions.jsonl` (`:1127-1138`).
- **Marque `demo`** : `_appareils_du_lot` exclut `d.get("demo")` **et** les `eid` vides
  (`:866-874`). Côté page, les 21 occurrences de `demo` sont **toutes conservées** (compte
  identique avant/après), et `regulerPont` n'est appelé que `&& !d.demo` (`:1104`).
- **Sonde** : `kind == "temp"` exclusivement (`:951`) ; deux sondes de température sur un lot →
  lot écarté, pas d'arbitrage par l'ordre du tableau (`:960-968`). Conforme au §4.3.
- **Consigne depuis la copie figée** : `recette = brut.get("recipe")` (`:922`), jamais
  `donnees.recettes` par `recipeId`. La régression de la v1 n'a pas été reproduite.
- **Tolérance** : `abs(tol)` si fini, sinon **0,2** (`:936`) ; les tolérances par `TYPES` ne
  sont pas utilisées. Conforme au §4.2.

### Écriture : durabilité, atomicité, verrou

- `_ecrire_durable` (`:558-586`) fait, dans l'ordre : temporaire, `flush`,
  `os.fsync(fileno)`, fermeture, `os.replace`, `fsync` du répertoire. Conforme au §3.
- `donnees.precedent.json` est écrit **avant** `donnees.json` (`:1254-1261`).
- La révision vit **dans l'enveloppe elle-même** : un `os.replace` raté laisse la révision
  d'avant, il n'y a aucun compteur mémoire à désynchroniser. C'est plus solide que ce que le
  contrat demandait.
- La quarantaine est écrite **avant** le document (`:1240-1243`) : un échec ultérieur exclut
  trop, jamais trop peu. Le commentaire dit vrai.
- `verrou_fichier` (`:590-631`) : `O_CREAT|O_EXCL`, péremption à 30 s, attente bornée à 5 s
  puis `TimeoutError` → 507. La révision est **relue du disque** sous le verrou (`:1189`).
- Double sérialisation assumée : une fois hors verrou pour refuser la taille (`:1819-1829`),
  une fois sous verrou après apposition de `maj`, et c'est celle-là qui fait foi (`:1237`).
- `allow_nan=False` : `json.loads` accepte `NaN`/`Infinity`, les stocker rendrait le document
  illisible par tout navigateur, pour toujours. Bonne prise.
- `base` : `isinstance(base, int) and not isinstance(base, bool)` — `base: true` n'est pas une
  révision (`:1797`).
- Idempotence par `op` : testée **avant** le test de révision (`:1205-1218`), seul ordre utile.
- **G4** : sceau présent + document absent → 409 `motif: "semence"` pour **toute** écriture,
  pas seulement `base: 0` (`:1201`). Plus strict que le contrat.
- Sceau illisible tenu pour **présent** (`:703-715`) : abîmer `semence.json` ne rouvre pas la
  porte du `base: 0`.
- Sceau illisible mais semence portée par le document : reprise plutôt que reforgée
  (`:1244-1249`) — sinon toutes les pages croiraient G1 déclenché et se figeraient.
- `decisions.jsonl` : `fsync` par ligne, rotation à 256 Kio, une génération, et une ligne
  tronquée ne fait pas perdre les autres (`:822-827`).
- Échec d'écriture des accessoires **après** le document : 200 avec un avertissement, et non
  507 — répondre 507 ferait rejouer une écriture déjà faite (`:1275-1289`). Raisonnement juste.

### Écritures concurrentes, côté page

- **Une seule écriture en vol** : `PONT.enVol` (`:1864-1866`), remis à faux dans tous les
  chemins de sortie, y compris sur exception.
- **`base` ne vient jamais d'un compteur local** : `PONT.rev` n'est affecté que depuis une
  réponse du pont (`:1877`, `:1884`, `:1912`, `:1935`) ou depuis `D.rev` d'une divergence que
  le pont a fournie.
- **La version refusée est conservée** : `sauvegarderLocal('hakko-dashboard-v2-refuse-')` sur
  tout 409 (`:1874`), trois générations, et un bandeau qui propose de la réappliquer.
- **« Garder les miennes » ne réactive rien** : `pontEcrireDonnees(D.rev)` sans `reactiver`,
  et le `confirm()` **nomme** les lots qui ne seront pas réactivés (`:2925-2936`).
- **Invariant 6 (état local volatil)** : `APPAREIL_PARTAGE = [id, eid, name, kind, batch,
  mode, slot, demo]` — exactement la liste du §7. `projectionPartagee` filtre par liste
  blanche, pas par liste noire : un champ volatil ajouté plus tard ne fuitera pas.
  `adopterDocument` rapatrie symétriquement l'état volatil local (`:1803-1812`).
  Et `tick()` ne touche `d.value`/`d.seen` que si `PONT_LOCAL` (`:1076`).
- **Invariant 7 (élagage de quota)** : `save()` n'élague que `S.hist` et `S.eventsArchive`
  (`:845-853`), tous deux locaux. Il ne touche jamais `recipes`, `batches`, `devices`.
- **`adopterDocument` ne détruit pas les mesures** : seules celles des lots disparus sont
  purgées (`:1818`). Les courbes de l'appareil qui adopte survivent.

### Dépendances et environnement

- **Aucune dépendance nouvelle côté pont** : les trois imports ajoutés (`contextlib`,
  `secrets`, `urllib.parse`) sont de la bibliothèque standard.
- **Aucune dépendance nouvelle côté page** : aucun `<script src>`, aucun `@import` ajouté ;
  les trois liens `fonts.googleapis.com` sont **préexistants** (hors diff). Un seul fichier
  HTML. L'export utilise `Blob` + `URL.createObjectURL`, rien d'autre.
- `pont.py` compile (`py_compile`, sans avertissement).

### Épreuves exécutées pendant cette revue

| Épreuve | Résultat |
|---|---|
| `_verify/essai-donnees.py` (11 assertions : rev 0, 409, idempotence `op`, 413, 400 sans `donnees`, 503 sous `PONT_AUTH=aucune`, 410 sur `/api/regul`, `/api/decisions`, **plan déduit qui allume**, **lot archivé qui coupe**) | **11/11** |
| `_verify/essai-file-local.mjs` (invariant 2 : page en `file://`, aucun appel réseau, aucune erreur JS, aucun bouton de partage proposé, export atteignable) | **12/12** |
| `_verify/essai-deux-appareils.mjs` (A pousse, B reçoit, G2 sur navigateur neuf, **B voit l'archivage fait sur A — le symptôme d'origine**, aucune prise allumée) | **13/13** |
| Sonde de revue : lot **archivé** rejoué par un appareil périmé (témoin) | garde `maj` **tient** : exclus, prise coupée |
| Sonde de revue : lot **supprimé** rejoué par un appareil périmé | garde `maj` **tombe** : lot au plan, prise **rallumée** → D1 |
| Sonde de revue : document posté vs document rendu | le pont ajoute `maj` → égalité impossible → D5 |

Le chemin nominal fonctionne, et le symptôme d'origine est bien corrigé. Les défauts sont tous
dans les chemins que ces épreuves ne traversent pas — ce qui est exactement ce que le §8
annonçait, et les épreuves manquantes du §8 sont celles qui les auraient trouvés.

---

## 4. Ce que je n'ai PAS pu vérifier, et pourquoi

- **Épreuve 4 du §8 — deux ponts, cinquante écritures concurrentes.** Non exécutée : il
  faudrait deux processus sur un même `/data` et un générateur de charge. Le verrou est lu et
  paraît correct, mais « paraît correct » n'est pas une preuve d'absence de perte de mise à
  jour. **Risque résiduel identifié à la lecture** : `VERROU_PERIME = 30 s` est un vol de
  verrou inconditionnel — sur un volume lent, une écriture qui dépasse 30 s se fait voler son
  verrou et deux `os.replace` se croisent. Le code ne revalide pas la possession du verrou
  avant le `replace`.
- **Épreuve 6 — `kill -9` pendant une écriture, dix fois.** Non exécutée. De plus,
  `_fsync_repertoire` **ne fait rien sur Windows** (`os.open` d'un répertoire échoue, et la
  fonction retourne silencieusement — `pont.py:544-549`) : la durabilité du renommage n'est
  donc pas observable sur cette machine. Elle n'est plausible que dans le conteneur Linux, et
  elle n'y a pas été éprouvée.
- **Épreuve 7 — le sceau, `/data` vidé avec deux navigateurs porteurs de données.** Non
  exécutée (demande deux navigateurs réels et un effacement de volume en cours de route). G1
  est lu et paraît juste, y compris le cas `semence: null`.
- **Épreuve 9 — le silence : trente minutes, deux appareils, zéro 409 et zéro incrément de
  `rev`.** Non exécutée. C'est l'épreuve la plus importante qui manque, et **D5 donne une
  raison de penser qu'elle échouerait** au premier rechargement d'onglet. À faire avant tout
  déploiement.
- **Épreuve 5 — le refus à 1 Mio par le pont et non par nginx.** Le 413 du pont est vérifié
  (assertion 6 de `essai-donnees.py`), mais le comportement de nginx ne l'est pas, et
  `client_max_body_size` n'est pas déclaré (D6b).
- **Invariant 4 — « la page servie reste l'octet pour octet du fichier local ».** Demande
  l'image et le cluster ; hors de portée d'une relecture.
- **Invariant 5 — deux images distinctes, pas de croisement de responsabilités.** Non
  inspecté (Dockerfiles et CI hors du périmètre indiqué).
- **Le comportement d'un `localStorage` réellement saturé** (D8) : raisonné sur le code, non
  reproduit — il faudrait saturer un profil de navigateur.
- **Le rendu du bandeau dans les autres vues que l'accueil** : `bandeauPartage()` n'est appelé
  que depuis `home()` (`:2242`, et défini en `:2276`). Sur `#/f/<id>`, `#/appareils`, `#/recettes`, un utilisateur
  bloqué par G1 ou par une divergence ne voit **rien**. Je le signale comme observation plutôt
  que comme défaut : je n'ai pas vérifié s'il existe un autre point d'affichage, et le §6
  n'exige pas explicitement l'omniprésence du bandeau. À trancher par le propriétaire.
