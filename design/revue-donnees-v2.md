# Revue de sûreté v2 — vérification des corrections annoncées

Relecture de contrôle de `design/revue-donnees-partagees.md` (mon rapport bloquant du
2026-10-03). L'implémenteur annonce D1, D2, D4, D5, D6, D7 corrigés. Je vérifie, je ne crois pas.
Aucune modification de code faite. Aucun contact avec 192.168.1.51, aucun `allume=true` vers
une prise réelle : faux Home Assistant et boucle locale uniquement.

Chaque affirmation est étiquetée **EXÉCUTÉ** ou **LU**.

---

## VERDICT (provisoire — en cours d'enrichissement)

**BLOQUANT. Ne pas déployer aujourd'hui.** Deux raisons, chacune suffisante :

1. **N1 — l'écran affirme une régulation qui n'existe plus.** La correction de D4 a rendu
   `regule` toujours vrai côté pont, donc la page ne commande plus jamais. Mais
   `surveillance()` (`hakko-dashboard.html:2623-2648`) n'a **pas** été mise à jour : elle ne
   teste nulle part `PONT.regule` et annonce toujours **« régulée par la page »** avec
   `warn: false` (vert). Pour un lot **exclu du plan** (quarantaine de la garde `maj`, deux
   sondes de température, prise hors liste blanche), personne ne chauffe et l'écran est vert.
   Et `grep exclus hakko-dashboard.html` → **zéro occurrence** : le pont sert `exclus[]`
   (`pont/pont.py:2018`), la page ne le lit pas. C'est le défaut historique du propriétaire
   **retourné** : l'écran dit une chose, la réalité en fait une autre. La moitié de ma
   recommandation D4 — « puis vérifier que la page affiche `exclus[]` » — n'a pas été faite.
   **EXÉCUTÉ** (grep) + **LU** (corps de `surveillance`).

2. **D7 n'est pas corrigé — il est déplacé.** `GESTES_EDITION` est testé à l'entrée du
   gestionnaire de **clics** (`hakko-dashboard.html:2925`). Or les gestes que j'avais nommés
   ne passent pas par un clic : `assign` et `plug-mode` sont dans le gestionnaire de
   **`change`** (`:3084-3085`), les densités / notes / **consigne** dans le gestionnaire de
   **`submit`** (`:3101-3115`). Aucun des trois gestionnaires ne consulte `GESTES_EDITION`
   sauf celui des clics, et `assign` / `plug-mode` ne sont même pas dans la liste. Le geste
   du §5.1 étape 7 — **rattacher un appareil à un lot** — reste donc non marqué, ainsi que
   **le changement de consigne** (`b.recipe.temp`, `:3113`), que je n'avais pas vu la
   première fois et qui est la donnée même sur laquelle le pont décide de chauffer.
   Conséquence inchangée : `S.ensemence` reste vrai, et `pontSynchroDonnees` **adopte
   automatiquement, sans confirmation** (`:1938-1941`). **LU** + **EXÉCUTÉ** (énumération
   exhaustive des `data-action` comparée à la liste).

Ce qui est en revanche **réellement corrigé et vérifié par exécution** : D1 (le défaut le plus
grave de ma première passe), D2, D5 (partiellement vérifié), D6.

---

## 1. D1 — mémoire persistante des `maj` : **CORRIGÉ**. Vérifié par exécution.

**EXÉCUTÉ** : `python _verify/verif-d1-lot-supprime.py` →
`VERDICT : D1 NON reproduit — les deux cas sont protégés.`

```
[memoire avant rejeu] majs={'b1': 1791046875} quarantaine=[]
[maj rejoue] 1791046875                     <-- maj ÉGAL, pas antérieur
SUPPRIMÉ   exclus=[{'lot':'b1', motif:'réactivation refusée…'}] plan=[] allumée=False avert=2
```

Le cas qui rallumait la prise dans ma première passe (lot **supprimé** rejoué par un appareil
périmé) est maintenant exclu du plan, prise coupée, deux avertissements. Et il l'est **même à
`maj` égal**, ce qui est le cas réel du rejeu.

Mécanique vérifiée à la lecture, et elle est juste :

- `lire_meta` lit `majs` avec un filtrage de type strict, `bool` exclu (`pont.py:774-777`).
- La mémoire **prime et ne recule jamais** : `maj_connu = memoire if maj_connu is None else
  max(maj_connu, memoire)` (`pont.py:1148`). Le `max` est le bon sens : jamais le plus
  permissif.
- `ressuscite_apres_suppression = ancien is None and connu_de_memoire` (`pont.py:1155`),
  injecté dans `resurrection` en **ou** avec la comparaison stricte (`pont.py:1176-1184`).
- Mémoire remise à jour après apposition, par `max` (`pont.py:1303-1310`), **avant** l'écriture
  du document.
- Écrite avec la quarantaine **avant** le document quand il y a des ajouts (`pont.py:1314`) :
  un échec ultérieur exclut trop, jamais trop peu. L'ordre est le bon.
- Le commentaire C1, qui soutenait le choix inverse, a été réécrit et dit maintenant vrai
  (`pont.py:746-751`) — **C1 est donc fermé** par la même passe.

### Régression sur la quarantaine : cherchée, **non trouvée**

La question qui compte : un lot légitimement édité peut-il être exclu à tort, et donc une
fermentation s'arrêter sans raison ? Les quatre chemins :

| Geste légitime | `ancien` | mémoire | `presente` | résurrection ? |
|---|---|---|---|---|
| édition d'un lot actif (même seconde) | présent | présent | `None` (la page retire `maj`) | **non** — `not actif_avant` est faux |
| création d'un lot neuf | absent | absent | `None` | **non** — `maj_connu is None` |
| archivage d'un lot | présent | présent | `None` | **non** — `actif` est faux |
| réactivation voulue d'un lot archivé | présent | présent | `None` | **oui**, et c'est voulu → `reactiver[]` |

La comparaison ordinaire est bien restée **stricte** (`presente < maj_connu`, `pont.py:1182`),
donc le cas « édité dans la même seconde » ne tombe pas en quarantaine. Le commentaire
(`pont.py:1171-1175`) explique le choix et il est correct.

Le seul geste légitime qui tombe en quarantaine est la **restauration d'un lot supprimé**
(réimport d'un export, même identifiant) : résurrection → exclu → `reactiver[]` exigé. C'est
le sens sûr (ça arrête une chauffe, ça n'en lance pas), c'est récupérable, et au tour suivant
`ancien` n'est plus `None` donc le piège ne se rearme pas. **Acceptable.**

### La mémoire `majs` peut-elle croître sans fin, ou bloquer un lot pour toujours ?

Non aux deux. **LU**, `pont.py:792-799` : plafond `MAJS_MAX = 2048` (`pont.py:87`), et le tri
`key=kv[1], reverse=True` garde les **2048 `maj` les plus récents**, donc les plus protecteurs.
Un lot supprimé voit son souvenir figé à l'instant de sa suppression et finit par être évincé
après 2048 lots plus récents — borne saine pour un laboratoire domestique. Et un blocage se
lève par `reactiver[]`, plafonné à 64, journalisé.

---

## 2. D2 — refus d'engager une chauffe quand l'échéance est gelée : **CORRIGÉ**, avec une
réserve réelle

La correction est là, à l'endroit juste : `pont.py:1638-1646`, en **tête** de la branche
d'allumage `v < c - h and not alumees`, avant tout `commander_regule(..., True, ...)`.
`echeance_gelee()` vrai → `return`, aucune chauffe engagée. Le cycle que j'avais décrit
(plafond coupe → température retombe → tour suivant réarme `_echeances` à +90 min) est
rompu. La branche de repoussement (`pont.py:1653`) garde sa réserve, les branches de coupure
sont intactes. **LU** ; le scénario demande dix minutes de document illisible, je ne l'ai pas
rejoué en temps réel.

### N2 — nouveau défaut : `_gel_dit` ne sert à rien (journal noyé)

`boucle_regulation` recopie les lots à chaque tour : `lots = [dict(l) for l in _plan["lots"]]`
(`pont.py:1565`). `tour_lot` pose `lot["_gel_dit"] = True` (`pont.py:1640`) **sur la copie**,
jetée à la fin du tour. Le garde-fou « on le dit une fois » ne tient donc pas : la décision
« aucune chauffe engagée » part dans `decisions.jsonl` **à chaque tour**, soit toutes les 20 s.
Avec une rotation à 256 Kio et **une seule génération** conservée (`pont.py:829-830`), la trace
du début de l'incident est effacée en quelques heures — précisément la trace qu'on voudrait
lire. **LU + vérifié par comparaison au point gelé** : `_figee_dite` a exactement le même
défaut et il est **préexistant** (`design/pont-avant-donnees.py:693-694`), donc la passe n'a
pas introduit le mécanisme, seulement un second usage. Gravité : pas une prise qui chauffe —
une enquête rendue impossible. **À corriger**, pas bloquant.

---

## 3. D4 — `regule` indépendant du nombre de lots : **corrigé côté pont, laissé à mi-chemin
côté page**

Côté pont, c'est fait et bien fait : `"regule": _source_plan["lu"] > 0` (`pont.py:2010`), et
`lu` est posé par `rafraichir_plan` dès qu'une lecture aboutit — **y compris document absent**
(`pont.py:1066-1067, 1088`) — et aussi par `_plan_degrade` (`pont.py:1055`). Le mode dégradé
ne rend donc pas la main, comme annoncé. Côté page, `PONT.regule = !!(j && j.regule === true)`
(`hakko-dashboard.html:1999`) et `maitreRegul = PONT.actif && !PONT.regule && regulMaitre()`
(`:1083`) : la page s'efface. Le relais ne bat plus. **LU.**

Mais la conséquence de ce choix n'a pas été portée jusqu'à l'écran — voir **N1** en tête de ce
rapport. La page ne régule plus jamais et continue d'écrire « régulée par la page ». C'est le
défaut qui me fait maintenir le verdict bloquant.

### « Personne ne régule plus » : le cas existe-t-il ?

- **Pont injoignable** : `PONT.regule = false` (`:1989`), mais `maitreRegul` exige
  `PONT.actif` → la page ne régule pas non plus. Ce n'est **pas** un défaut : la page ne sait
  commander une prise qu'**à travers** le pont (`POST /api/prise`). Pont mort = aucune
  commande possible, par construction.
- **Lot exclu du plan** : le pont ne chauffe pas, la page ne chauffe pas. Personne ne chauffe.
  C'est le sens voulu (l'exclusion arrête la chauffe) — mais il est **muet à l'écran** : N1.
- **Fenêtre de redémarrage du pont (N3)** : `_source_plan` est en mémoire seule, absent de
  `sauver_etat`/`charger_etat` (**EXÉCUTÉ** : `grep -n _source_plan pont/pont.py` → 408, 1054,
  1055, 1084, 2010, 2018, 2020-2023 ; aucune occurrence dans la persistance). Après un
  redémarrage, `lu == 0` jusqu'au premier `rafraichir_plan()`, donc `/api/regul` répond
  `regule: false` et une page qui sonde à cet instant se croit régulatrice. La fenêtre est
  courte (le premier tour est en tête de `boucle_regulation`, `pont.py:1563`) et
  `charger_etat` a déjà relu le plan, mais c'est un bref partage d'autorité à la pire minute —
  celle d'un déploiement. **Dériver `regule` de `magasin_present()` plutôt que de `lu > 0`
  fermerait le cas sans rien coûter.** À corriger, non bloquant.
- **`PONT_ETAT` et `PONT_DONNEES` vides** : `magasin_present()` faux → `rafraichir_plan` sort
  tout de suite (`pont.py:1060`) → `lu` reste 0 → `regule: false` **pour toujours**, et la page
  redevient l'unique régulateur. Ce n'est pas la configuration déployée (`k8s/deployment.yaml`
  monte le volume) et `main` le journalise en `stderr` (`pont.py:2131-2135`), mais le pont
  **démarre quand même**. À la lumière de la passe, cette configuration est devenue un mode de
  fonctionnement sans régulateur serveur et devrait refuser de démarrer.

---

## 4. D6 — préalables d'installation : **CORRIGÉ**, les trois

**LU**, et les trois points de ma liste sont faits :

| Point | État | Preuve |
|---|---|---|
| `PONT_AUTH=jeton` | fait | `k8s/deployment.yaml:95-96`, `value: "jeton"` |
| `PONT_JETON` non optionnel | fait | `k8s/deployment.yaml:99-103`, `secretKeyRef` sans `optional`, et `Config.verifier` refuse de démarrer sous `JETON_MIN` (`pont.py:185-190`) |
| `client_max_body_size 528k` | fait | `nginx.conf:85` |
| `strategy: Recreate` | fait | `k8s/deployment.yaml:22-23`, commentaire explicatif en `:17-21` |

Le commentaire de `deployment.yaml:87-94` dit la conséquence à l'exploitant (chaque appareil
saisit le jeton une fois) : c'est la bonne information au bon endroit.

**EXÉCUTÉ** : `python _verify/essai-donnees.py` → **11/11**, dont l'assertion 7 qui vérifie
qu'en `PONT_AUTH=aucune` le magasin répond bien 503 (le comportement n'a pas changé, c'est la
configuration qui a changé).

---

## 5. D5 — normalisation de la signature : **corrigé**, vérification en cours

`sansMaj()` (`hakko-dashboard.html:1684-1694`) retire `maj` de chaque lot ;
`signatureDe(doc)` (`:1695`) signe la projection normalisée ; `signaturePartagee()` (`:1696`)
l'applique à la projection locale. Les deux côtés de chaque comparaison passent désormais par
`signatureDe` : `:1938`, `:1941`, `:1965`. La comparaison est donc symétrique — c'était tout le
défaut. **LU** ; reste à confirmer par exécution des épreuves navigateur.

---

## 6. Les freins de régulation — à vérifier

Comparaison au point gelé `design/pont-avant-donnees.py` en cours. Premier élément acquis :
`boucle_regulation` recopie toujours les lots par tour, identique au point gelé (`:633` contre
`pont.py:1565`), et la branche `_figee_dite` est inchangée (`:693-694` contre `:1625-1626`).

---

## 7. D3, D8, D9, C1..C7 — bloquant ou acceptable

En cours de rédaction. C1 est **fermé** par la correction de D1 (commentaire réécrit,
`pont.py:746-751`).

---

*Rapport en cours. Les sections 5, 6 et 7 sont enrichies au fil de la relecture.*
