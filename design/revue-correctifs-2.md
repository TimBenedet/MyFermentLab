# Seconde revue des correctifs — dashboard de fermentation (`scada-opus-5.5/hakko-dashboard.html`)

Suite de `design/revue-correctifs.md`. J'ai relu `design/correctifs-diff.txt` et le fichier de travail
actuel. Les numéros de ligne renvoient au fichier **après** correctifs. Aucun fichier autre que ce
rapport n'a été modifié.

## Résumé

Les trois points bloquants du premier rapport sont traités **dans le cas nominal**, c'est-à-dire avec
le pont actif, la sonde en ligne et un onglet qui synchronise :

- §1 : la mémoire grandit bien, avec un point par tranche de 3 minutes. ✅
- §3 : un lot réel n'est plus classé « démo » à cause d'une prise de la maquette. ✅
- §7.1 : les bascules de repli portent `sim` et ne s'affichent plus dans le journal d'un lot réel. ✅
  (Ce point est traité en partie seulement, voir N2.)

En revanche, cette version introduit ou laisse passer quatre défauts qui touchent directement les
symptômes d'origine :

1. **`!PONT.actif` sert à reconnaître la maquette (N1).** Or le pont est aussi inactif à chaque
   chargement de la page, pendant une coupure, et **en permanence dans un navigateur sans jeton**
   (le téléphone, par exemple). Dans tous ces cas, un lot réel affiche de nouveau le modèle à 60 °C,
   et ses événements simulés reviennent dans le journal. Le symptôme n° 1 réapparaît.
2. **La branche de repli de `tick()` bascule encore une prise réelle marquée `demo` toutes les
   15 s (N2).** Cela produit environ 240 événements par heure. Ils inondent « Activité récente »
   et, comme `S.events` est plafonné à 500, ils **chassent en moins de deux heures** tous les
   vrais événements : commandes `reel`, alertes, consignes. Cela arrive dès l'état par défaut
   (`o2` et la sonde `s3` sur le koji) et dans la configuration probable du propriétaire
   (`o3` et `s1` sur le garum).
3. **`save()` élague le mauvais historique et vide l'archive sans le dire (N3).** En cas d'échec
   persistant, il écrit une alerte toutes les 3 s, ce qui alimente le même effet de chasse.
4. **Le libellé « coupée par le serveur après 90 min » est inchangé (§6 du premier rapport).**
   Il promet une coupure qui, dans plusieurs cas, n'est pas armée.

**Verdict : pas publiable en l'état.** Les corrections restantes sont courtes (voir la fin du
rapport). Aucune ne touche aux freins de régulation.

---

## A. Les trois points bloquants du premier rapport

### §1 — Pas de la mémoire (`enregistrerTemperatures`, l. 871-887) : **traité**

- Le point est ancré sur `trancheHist(t) * HIST_PAS`, et seule la valeur est réécrite dans la
  tranche (l. 879-884). Avec une synchro toutes les 15 s, on obtient environ 12 réécritures, puis un
  nouveau point toutes les 3 min. La mémoire grandit donc vraiment.
- L'arrondi au centième est bien fait. L'humidité est rangée dans le même point (`[t, temp, hum]`).
  Un ancien point `[t, v]` reste lisible, puisque `p[2] != null` vaut `false`.
- **Changements d'heure : aucun risque.** `trancheHist` découpe l'horodatage epoch (UTC).
  180 000 ms divisent l'heure, et le passage heure d'été / heure d'hiver ne change pas `Date.now()`.
  L'affichage passe par `fmtTime` en heure locale, ce qui est correct.
- **Reste un risque mineur : un recul de l'horloge système** (correction NTP, machine mise à l'heure
  à la main). Si `t` recule d'une tranche ou plus, `trancheHist(t) !== trancheHist(dernier[0])` et on
  pousse un point **plus ancien** que le précédent. La mémoire n'est alors plus triée.
  `tempCfg` relie ce point en arrière, et l'écart négatif ne coupe jamais la série.
  **Correction :** `if (dernier && t < dernier[0]) return;`, ou bien une condition
  `trancheHist(t) <= trancheHist(dernier[0])` pour la réécriture.

### §3 — Discriminant réel / démo : **traité, mais un nouveau défaut est apparu (N1)**

`sondeReelle(b)` (l. 859) correspond à ce que je proposais, avec en plus `d.online`. `estDemo` passe
à « tous les appareils sont `demo` » (l. 854). Voici l'effet, lot par lot :

| Lot | Appareils | Avant | Maintenant |
|---|---|---|---|
| `b1` Saison | `s1` (réelle), `o1` (demo) | démo | **réel** |
| `b2` Miso | `s2` (réelle) | réel | réel |
| `b3` Koji | `s3`, `h1` (réelles), `o2` (demo) | démo | **réel** |
| `b4` Garum, état par défaut | `o3` (demo) seule | démo | démo |
| `b4` Garum, configuration du propriétaire | `s1`, `o4`, plus `o3` restée reliée | démo | **réel** ✅ |
| Lot sans appareil (dont les lots terminés, libérés par `finish`) | — | réel | réel (`ds.length > 0`) |

- **Cohérence avec la marque `demo` qui protège contre un second navigateur : correcte.**
  `estDemo` ne sert qu'à l'affichage (courbes, vignette, journal). La régulation teste toujours
  `!d.demo` **prise par prise** (l. 931). Un navigateur neuf ne commande donc toujours ni `o1`, ni
  `o2`, ni `o3`.
- Il y a une conséquence à connaître. Dans un navigateur neuf, `b1` et `b3` (lots fictifs du jeu de
  démonstration, mais branchés sur de vraies sondes) deviennent « réels ». Leur courbe démarre vide,
  et leur journal masque les 36 h de chauffe fabriquées. La démonstration paraît donc plus pauvre.
  Le résultat est honnête, mais il vaut mieux le savoir.
- `d.online` dans `sondeReelle` a un effet de bord : voir N4.

### §7.1 — Fausse chauffe de la branche de repli : **traité pour le journal du lot, pas à la source**

`logHeat(d, b, tp, false, null, true)` (l. 936) marque bien `sim`, et `journalHTML` filtre par
événement (l. 1654). Mais la branche modifie encore `d.on` d'une prise qui a un `eid`, et elle
journalise toujours. Les conséquences sont décrites en N2 : inondation, chasse des vrais événements,
faux « externe ». J'avais proposé de ne rien faire hors maquette, et ce n'est pas repris.

---

## B. Les dix changements annoncés

| # | Changement | Vérifié | Remarque |
|---|---|---|---|
| 1 | Ancrage sur la tranche | ✅ | Recul d'horloge, voir §1. |
| 2 | `estDemo` = tous `demo` | ✅ | Voir le tableau du §3. |
| 3 | `sondeReelle` | ⚠️ | Correct pont actif. Le repli `!PONT.actif` est trop large (N1). Une sonde hors ligne masque toute la mémoire (N4). |
| 4 | Repli de `tick()` marqué `sim` | ⚠️ | Marquage correct, mais la bascule locale continue (N2). |
| 5 | `regulerPont` marque `reel`, épargné par la migration | ✅ | l. 1213. Les commandes réelles **antérieures** restent archivées, et la note le dit désormais. |
| 6 | Journal filtré par événement | ⚠️ | Le filtre est juste, mais `accepteSim` hérite du défaut N1. « Activité récente » n'est toujours pas filtrée (l. 1283, 1539). |
| 7 | Vignette : abscisse, point unique, fin de lot | ✅ / ⚠️ | Abscisse corrigée (l. 1048). Garde `active` en place (l. 1040). Le point dupliqué trace un palier sur **toute** la largeur (N6). |
| 8 | `tempCfg` par plages, sans doublon | ⚠️ | Les coupures fonctionnent. Le point « d'avant » devient une série isolée invisible, et le survol ne lit que la première série (N5). Le libellé « en cours de constitution » ne s'affiche jamais (N7). |
| 9 | `humCfg` sur la mémoire | ✅ / ⚠️ | Mesures réelles, mais sans découpe des trous (N7). |
| 10 | `save()`, `finish`, purges | ⚠️ | `finish` et `delete-batch` sont corrects. La purge au démarrage est correcte. `save()` est défectueux (N3). |

---

## C. Nouveaux défauts et défauts restants

### N1. `!PONT.actif` n'est pas « la maquette » (bloquant)

`sparkPath` (l. 1035), `tempCfg` (l. 1075), `humCfg` (l. 1102) et `journalHTML` (l. 1654)
réactivent le modèle et les événements `sim` dès que `PONT.actif` est faux. Or `PONT.actif` est
faux dans les situations suivantes :

- **à chaque chargement**, entre `render()` (l. 2115) et la réponse de `pontSynchro` (l. 2117) : le
  modèle s'affiche, puis disparaît ;
- **pendant une coupure** du pont ou du réseau (l. 1353, 1363, 1365) ;
- **en permanence dans un navigateur sans jeton.** Le 401 en mode silencieux pose
  `PONT.jetonRequis` et ne retente plus (l. 1350, 1356). C'est le cas d'un téléphone ouvert sur la
  page : `b4` y affiche de nouveau le garum à 60 ± 0,5 °C, avec ses chauffes simulées dans le
  journal.

Dans tous ces cas, la mémoire réelle (`S.hist`) existe, mais elle n'est **pas** affichée :
`sondeReelle` exige `PONT.actif`. Les sondes réelles reçoivent en plus des valeurs du modèle, parce
que le §7.2 du premier rapport n'est pas traité (l. 903-908). La carte, le statut et le point
« live » mentent donc aussi.

**Correction :**
- Remplacer `!PONT.actif` par `PONT_LOCAL` aux quatre endroits.
- Séparer « la courbe vient de la mémoire » (`histDe(b).length > 0`, sans condition sur le pont) de
  « on enregistre maintenant » (`sondeReelle`, utile seulement dans `enregistrerTemperatures`).
- Appliquer le §7.2 : `if (d.eid && !PONT_LOCAL) continue;` dans la première boucle de `tick`.

### N2. La branche de repli bascule encore les prises réelles marquées `demo` (bloquant)

Prenons l'état par défaut, pont actif : `b3` a pour consigne 30 °C, `s3` mesure environ 27 °C et
`o2` est en `auto` et `demo`.

1. `tick` (toutes les 3 s) : `voulu = true` et `d.on = false`. On passe dans le `else` (l. 936) :
   `o2.on = true`, et un événement `heat-on` `sim` est écrit.
2. `pontSynchro` (toutes les 15 s) : la prise réelle est éteinte. `d.on !== etat` et il n'y a pas de
   `cmdT`, donc `origine = 'externe'` (l. 1335) et `o2.on = false`.
3. Au tick suivant, on recommence.

Il en résulte :
- **environ 4 événements par minute, soit environ 240 par heure** pour chaque prise concernée. La
  même chose arrive avec `o3` dans la configuration du propriétaire (`s1` reliée à `b4`, à
  température ambiante, sous les 60 °C) ;
- `S.events` est coupé à 500 (l. 1193, 1198). **En moins de deux heures, les vrais événements sont
  chassés** : commandes `reel` de `o4`, alertes de sécurité, changements de consigne, note de
  migration. Le journal d'un lot réel finit vide, alors que le but était qu'il ne garde que les
  commandes réellement parties ;
- « Activité récente » n'est pas filtrée (l. 1283, 1539). Elle n'affiche plus que « Multiprise Tim
  Outlet 2 : activation de la chauffe à 26,9 °C » ;
- `heater(b)` lit la **première** prise du lot (l. 962). Pour `b4`, c'est `o3`, avant `o4`.
  « Chauffe active / Veille » clignote donc selon la simulation et non selon `o4`. Le KPI
  « Chauffages » clignote aussi.

**Correction :** `else if (!d.eid || PONT_LOCAL) { d.on = voulu; logHeat(..., true); }`. Une prise
qui a un `eid` sur une page servie par le cluster ne doit pas être basculée localement.
Accessoirement, il faudrait appliquer à `feedHTML` le même filtre que celui du journal.

### N3. `save()` en cas de quota plein (à corriger)

```js
const cles = Object.keys(S.hist).sort((a, c) => S.hist[a].length - S.hist[c].length);   // l. 812
const k = cles[0]; S.hist[k] = S.hist[k].slice(-Math.max(2, …));                         // l. 814
```

- **On élague le plus petit historique.** Le tri est croissant. On divise donc par deux le lot qui
  pèse le moins, et à l'échec suivant on retombe sur le même. Une fois réduit à 2 points, il ne
  libère plus rien. Le gros historique, qui est la vraie cause, n'est jamais touché. Il faut trier
  par ordre décroissant, ou élaguer tous les historiques à la fois.
- **L'archive est vidée en silence** (l. 817-819). On fait `return` sans `logEvent`. Le message de
  migration promettait « archive conservée ». Si on la sacrifie, il faut le dire.
- **Une alerte est écrite à chaque échec, soit toutes les 3 s** (l. 821). Elle passe aussi par
  `S.events` et chasse les vrais événements en 25 min, comme en N2. De plus, cette alerte n'est
  jamais persistée, puisque l'écriture échoue. Il faut une alerte unique, par exemple avec un
  drapeau en mémoire `PONT.quotaSignale`, et un bandeau visible plutôt qu'une ligne de journal.
- L'alerte de la l. 815 est écrite **après** l'écriture réussie : elle ne sera sauvegardée qu'au
  prochain `save()`. C'est mineur.
- Le quota est commun avec `REGUL_CLE` (l. 692), dont l'échec est avalé. Quota plein, chaque onglet
  se croit maître. Le cas est rare et le pont garde sa coupure, mais c'est à noter.
- La clé séparée pour `S.hist` (proposition 4 du premier rapport) n'est pas reprise. C'est elle qui
  garantissait que l'état de régulation reste persisté quoi qu'il arrive à l'historique.

### N4. Une sonde hors ligne efface toute la courbe

`sondeReelle` exige `d.online` (l. 859). Quand la sonde décroche, pont actif, `reel` devient faux,
`estDemo` est faux, `PONT.actif` est vrai, et donc `segs` est vide. `cur` vaut `null` (aucune sonde en
ligne), et `drawChart` affiche « Pas encore de mesure. » La vignette se vide aussi (l. 1042). **Les
9 jours de mesures disparaissent de l'écran justement pendant la panne**, alors que c'est le moment
où l'on veut voir quand la mesure s'est arrêtée. La correction est la même qu'en N1 : la courbe
dépend de `histDe(b).length`, pas de l'état en ligne.

### N5. `tempCfg` : point « d'avant » et survol

- Le point antérieur à `from` est ajouté **comme une série à part** d'un seul point
  (`segs.unshift([[…]])`, l. 1073). Une série d'un point ne trace rien (`M x y` seul). Ce point est
  en plus placé à gauche de `x0: from`, donc hors de la zone de tracé, et il entre quand même dans
  l'échelle verticale (`ys`). Le commentaire dit « pour que la courbe parte de quelque part » : ce
  n'est pas ce qui se passe. Il faut le préfixer à `segs[0]` si l'écart est inférieur à
  `2 * HIST_PAS`, ou bien ne pas l'ajouter du tout.
- **Le survol ne lit que la première série** (`pts: c.series[0].pts`, l. 1005). Dès qu'il y a une
  coupure, ou ce point isolé, l'infobulle ne trouve que les points du premier segment. Avec le point
  isolé en tête, elle reste collée sur lui. Il faut passer à `_sc` la concaténation de toutes les
  séries.
- `cur` est ajouté à la dernière série même si celle-ci s'arrête depuis longtemps (l. 1084). Cela
  recrée le trait droit au-dessus d'un trou. En pratique, c'est rare : une synchro réussie écrit
  aussitôt un point frais. Le test devrait quand même comparer l'écart à `2 * HIST_PAS`.

### N6. Point unique de la vignette

`pts.push(pts[0])` (l. 1043) trace un palier **sur toute la largeur**, ce qui se lit comme « 24 h à
cette température ». Il serait plus juste de tracer un court segment collé à droite, ou un simple
point. La règle « rien de mieux que faux » du premier rapport s'applique aussi au cas
`vus.length <= 1` : `h.slice(-2)` montre encore deux mesures anciennes comme si elles étaient
récentes (l. 1034).

### N7. Détails

- `label: (reel && hist.length < 2) ? …` (l. 1094) n'est jamais vrai, puisque `reel` exige déjà
  `hist.length > 1`. Le message « Mémoire des mesures en cours de constitution » ne s'affiche donc
  jamais. Il faut tester `sondeReelle(b) && hist.length < 2`.
- `humCfg` ne coupe pas les trous : une panne d'humidité est reliée par un trait droit. L'humidité
  n'est enregistrée que si le lot a une sonde de **température** réelle : un lot équipé seulement
  d'une sonde d'humidité n'a jamais de mémoire.
- `enregistrerTemperatures` prend `currentTemp(b)`, c'est-à-dire la première sonde en ligne. Si un
  lot mélange une sonde réelle et une sonde sans `eid` (simulée par `tick`), la mémoire peut
  enregistrer la sonde simulée. Il faut choisir explicitement la sonde `eid`.
- `finish` : le résumé ne contient ni pourcentage dans la plage, ni points sous-échantillonnés. Il
  couvre au plus les 9 derniers jours. Ce point est connu et lié à la rétention.

### Migration (l. 1210-1220)

- Le filtre `!e.sim && !e.reel` est correct, et la note est reformulée comme je le proposais. ✅
- **Le drapeau `migrationSim` porte le même nom que dans la première version.** Un navigateur qui a
  ouvert la première version **sur la même origine** a déjà le drapeau. Il garde donc les faux
  événements non marqués que le repli de `tick()` a écrits entre-temps. D'après `git status`, cette
  première version n'a été ni commitée ni déployée : le risque se limite aux essais faits sur
  l'origine du cluster. Renommer le drapeau (`migrationSim2`) coûte une ligne et lève le doute.

---

## D. Points du premier rapport non repris (hors des dix changements)

| Point | État | Gravité |
|---|---|---|
| §6 `surveillanceTexte` (l. 1802) : « coupée par le serveur après 90 min » pour toute prise `auto` reliée, y compris lot sans sonde, pont injoignable, `regulPause`, ou prise allumée ailleurs alors qu'elle est en auto (aucune échéance armée, ni côté pont ni côté page) | **Inchangé** | **Bloquant** : promesse de sécurité fausse |
| §6 « allumée à la main, personne ne la surveille » sans couleur d'alerte (l. 1784), et aucune couleur dans « Appareils reliés » | Inchangé | Moyen |
| §6 fenêtre `cmdT` de 90 s (l. 1335) | Inchangé | Faible |
| §7.2 valeurs du modèle écrites dans les vraies sondes (l. 903-908) | Inchangé | Élevé (aggrave N1) |
| §7.3 puissance inventée (`d.power`) | Inchangé hors pont, mais persistée | Moyen |
| §7.3 « Activité récente » non filtrée | Inchangé | Élevé (aggrave N2) |
| §7.3 archive calculée sur le modèle (`archStats`, l. 1831) | Connu | Moyen |

Les points que le brief déclare connus (archive des événements non consultable, rétention de 9 jours,
`b.mesures` non affiché, échelle verticale qui inclut la consigne, absence de double
sous-échantillonnage) ne sont pas repris ici. Le premier d'entre eux devient plus sensible depuis que
`save()` peut vider cette archive (N3).

## E. Invariants de sécurité

| Invariant | État |
|---|---|
| Rien ne peut allumer une prise | ✅ Aucun nouvel appel `pontRequete`. La bascule de repli (N2) ne modifie que l'état local ; elle n'envoie rien. |
| Freins `AUTO_COOLDOWN`, `AUTO_MAX_ON`, `AUTO_PAUSE`, `AUTO_REFUS` | ✅ Code inchangé. ⚠️ Persistance fragilisée par un quota plein (N3). |
| Marque `demo` | ✅ Aucun nouveau `delete d.demo`. Le changement de sens d'`estDemo` ne touche pas la régulation. |
| Contrat du pont (`auto: true` seulement depuis `regulerPont`) | ✅ Inchangé. |
| Affichage honnête de la surveillance | ❌ Inchangé (voir D). |

## Verdict

**Pas publiable en l'état.** Les relais ne courent toujours aucun risque, et le cas nominal (pont
actif, sonde en ligne) est enfin juste. Mais le journal d'un lot réel se vide en deux heures dans la
configuration par défaut comme dans celle du propriétaire (N2). Le modèle à 60 °C revient sur
n'importe quel navigateur sans jeton (N1). Et l'écran promet toujours une coupure qui peut ne pas
être armée.

Corrections, par priorité :

1. **N2** : dans le `else` de `tick` (l. 936), ne basculer et ne journaliser que si
   `!d.eid || PONT_LOCAL`. Filtrer `feedHTML` comme le journal.
2. **N1 et N4** : `PONT_LOCAL` au lieu de `!PONT.actif` (l. 1035, 1075, 1102, 1654). La courbe
   s'affiche dès que `histDe(b).length > 0`, pont actif ou non, sonde en ligne ou non. §7.2 :
   `if (d.eid && !PONT_LOCAL) continue;` en tête de la première boucle de `tick`.
3. **§6** : `surveillanceTexte` doit calculer si la coupure est vraiment armée (proposition du
   premier rapport). Ajouter la couleur d'alerte pour « personne ne la surveille ».
4. **N3** : élaguer le plus gros historique (tri décroissant), signaler une seule fois, et dire
   quand l'archive est sacrifiée. Idéalement, utiliser une clé `localStorage` séparée pour
   `S.hist`.
5. **N5** : survol sur toutes les séries, point « d'avant » rattaché au premier segment ou
   supprimé.
6. **§1, N6, N7, migration** : garde contre le recul d'horloge, palier court dans la vignette,
   libellé « en cours de constitution » atteignable, découpe des trous pour l'humidité, sonde
   `eid` explicite, drapeau `migrationSim2`.
