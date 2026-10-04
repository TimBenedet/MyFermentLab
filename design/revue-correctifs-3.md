# Troisième revue des correctifs — dashboard de fermentation (`scada-opus-5.5/hakko-dashboard.html`)

Suite de `design/revue-correctifs.md` et `design/revue-correctifs-2.md`, selon
`design/brief-revue-correctifs-3.md`. Les numéros de ligne renvoient au fichier de travail actuel.
Aucun fichier autre que ce rapport n'a été modifié.

**Remarque préalable : `design/correctifs-diff.txt` n'est pas à jour.** Il contient encore l'état du
second passage : `sondeReelle` avec `d.online` (l. 59 du diff), le `else { d.on = voulu; … }` sans
condition (l. 101), et le tri croissant dans `save()` (l. 28). Aucune occurrence de `PONT_LOCAL`
n'y figure. J'ai donc vérifié sur le fichier lui-même et sur `git grep HEAD`, pas sur le diff.

## Résumé

Les sept corrections annoncées sont présentes dans le fichier. Côté relais, le bilan est meilleur
qu'avant : la page ne bascule plus aucune prise réelle hors maquette. L'inondation du journal (N2)
a disparu.

- N2, N3, N4, N6, N7 (libellé) et R9 : **traités**.
- N1 : **traité pour le modèle**, qui ne revient plus hors maquette. En revanche, la seconde moitié
  de la correction (« la courbe vient de la mémoire, pont actif ou non ») n'est pas faite. Pendant
  une coupure du pont, la courbe réelle disparaît (voir P3).
- N5 : **traité en partie.** Le point d'amorce est rattaché au segment, mais sans test d'écart, et
  il est tracé hors de la zone du graphique (voir P5).
- La correction « 60,0 °C » **déplace le défaut au lieu de le supprimer.** La simulation ne
  touche plus la valeur. Mais la valeur qu'elle a déjà écrite, ou la valeur du jeu de démonstration,
  reste affichée **indéfiniment** comme une mesure en direct, sur tout navigateur où le pont ne
  répond pas. C'est justement le navigateur de la capture d'écran (P1).
- **Nouvelle régression** : la colonne « Dernière remontée » des vraies sondes et prises n'est plus
  jamais mise à jour. Sur un navigateur neuf, elle affiche « il y a NaN j » (P2). C'était le seul
  indice de fraîcheur d'une valeur.

**Verdict : pas encore publiable, mais à deux corrections courtes près** (P1 et P2, avec P4 qui va
avec). Le cas nominal est juste : pont actif, sonde en ligne. Les relais ne courent aucun risque.
Ce qui reste bloquant, c'est qu'un navigateur sans pont présente une valeur figée comme une mesure
« En direct ».

---

## A. Les corrections annoncées, une par une

| # | Correction | Vérifié | Remarque |
|---|---|---|---|
| N1 | `PONT_LOCAL` au lieu de `!PONT.actif` | ✅ l. 1061, 1103, 1131, 1683 | Le modèle ne revient plus hors maquette. Mais `sondeReelle` exige encore `PONT.actif` (l. 873) : la mémoire réelle est masquée pendant une coupure (P3). |
| N2 | Repli de `tick()` limité à la maquette | ✅ l. 962 | Plus de bascule locale ni d'événement sur une prise `eid` hors maquette. L'inondation de `S.events` est réglée. |
| N3 | `save()` | ✅ l. 809-834 | Tri décroissant, garde `> 4`, suppression de l'archive annoncée, alerte limitée à une toutes les 10 min (`S.stockageAlerte`). La clé séparée pour `S.hist` n'est toujours pas faite (assumé). |
| N4 | `sondeReelle` sans `d.online` | ✅ l. 873 | Pont actif, une sonde qui décroche laisse un trou et la mémoire reste affichée. `cur` vaut `null`, donc pas de point « live ». C'est correct. |
| N5 | Point d'amorce rattaché au segment | ⚠️ l. 1099-1102 | Il n'y a pas de test d'écart, et le point est tracé hors cadre (P5). |
| N6 | Vignette à un point | ✅ l. 1071 | Plus de palier. Il reste `h.slice(-2)` quand la fenêtre est vide (l. 1060) : deux mesures anciennes sont montrées comme récentes. C'est mineur et déjà signalé. |
| N7 | Libellé de coupure | ✅ / ⚠️ l. 1834 | La phrase est vraie pour le serveur. Mais « régulée par la page » reste affiché quand la page ne régule pas (P6). |
| « 60,0 °C » | Pas de valeur simulée pour une entité `eid` hors maquette | ⚠️ l. 924, 966 | Plus de valeur inventée **à partir de maintenant**. Mais aucune valeur figée n'est retirée ni datée (P1). La première boucle de `tick` ne met plus à jour `d.seen` (P2). |
| R9 | Recul d'horloge | ✅ l. 895 | Correct. Effet de bord : si l'horloge a été réglée dans le futur puis corrigée, l'enregistrement s'arrête sans message jusqu'à ce que l'heure réelle rattrape l'heure erronée. C'est rare, il suffit de le savoir. |

**Absence de zone morte temporelle (TDZ) :** `PONT_LOCAL` est déclaré l. 1335, après `tick` et les
fonctions de graphique qui l'utilisent. Aucun code de premier niveau entre les l. 803 et 1335 n'appelle
ces fonctions. Le premier appel a lieu l. 2143. Il n'y a donc pas d'erreur de TDZ.

---

## B. Ce que les corrections cassent ou laissent passer

### P1. Une valeur figée est présentée comme une mesure en direct (bloquant)

La ligne 924 (`if (d.eid && !PONT_LOCAL) continue;`) fait que, sans pont, la page « conserve la
dernière valeur réellement reçue ». Mais rien ne vérifie que cette valeur a **été reçue** :

- **Navigateur de la capture d'écran.** Les versions précédentes ont écrit `model(b4).temp ≈ 60` dans
  `s1.value`, et `save()` l'a persisté toutes les 3 s. Ce navigateur n'a pas de jeton, donc
  `pontApplique` n'y passe jamais. **La carte affiche toujours 60,0 °C.** La valeur est maintenant
  figée au lieu d'osciller. Le statut dit « Dans la cible », parce que la valeur égale la consigne.
- **Navigateur neuf sans jeton** (un téléphone, par exemple) : les sondes affichent les valeurs du
  jeu de démonstration (l. 791-794 : 21,3 / 21,4 / 26,9 °C, 56,9 %), en permanence, comme des
  mesures. Les badges d'état, le KPI « Alertes », l'écart à la cible et le point « live » de la
  courbe (`tempCfg`, l. 1116) sont calculés à partir de ces valeurs.
- **Coupure du pont** sur un navigateur qui a un jeton : la vraie dernière valeur reste affichée sans
  limite de durée. C'est honnête pendant quelques minutes, plus du tout après une heure.
- `d.online` reste également à `true` (valeur du jeu de démonstration) : « En ligne », « Tous
  connectés ».
- Pour aggraver le tout, l'en-tête affiche « **En direct**, <heure actuelle> » quand le pont est
  inactif (l. 1313 : `PONT.actif && PONT.dernier ? PONT.dernier : new Date()`). Ce comportement est
  antérieur au correctif. Mais c'est ce bandeau qui fait lire la valeur figée comme une mesure
  fraîche.

**Correction (courte) :**
1. Dans `pontApplique`, poser `d.recu = Date.now()` (et `d.seen`, voir P2) pour chaque appareil
   présent dans la réponse.
2. Hors maquette, considérer comme absente la valeur d'une entité `eid` sans `d.recu` ou avec un
   `d.recu` trop ancien (par exemple plus de 10 min). Faire renvoyer `null` à `currentTemp` et
   `currentHum`, et afficher « — » dans `live('dev:…')`. Le lot affiche alors « Sans mesure » au
   lieu d'un statut calculé sur une valeur périmée. La régulation est déjà protégée, puisque
   `maitreRegul` exige `PONT.actif`.
3. À l'en-tête : « Pont injoignable », ou « Dernière synchro <PONT.dernier> », au lieu de
   « En direct, <maintenant> » quand `!PONT.actif && !PONT_LOCAL`.

Ces trois points règlent aussi la valeur 60,0 °C déjà persistée, sans migration : elle n'a pas de
`d.recu`.

### P2. « Dernière remontée » n'est plus jamais mise à jour (régression)

`d.seen` n'est écrit qu'à un seul endroit, dans la première boucle de `tick` (l. 926), **après** le
`continue` de la l. 924. `pontApplique` (l. 1353-1373) ne l'écrit pas. Avec la version commitée
(`HEAD`, l. 839-841), le `continue` ne s'appliquait que si `PONT.actif`. `seen` était donc
rafraîchi au moins à chaque chargement et pendant les coupures. C'était déjà imparfait, mais la
valeur bougeait.

Désormais, hors maquette :
- un état existant garde à jamais le `seen` de la dernière simulation : « il y a 3 j » pour une
  sonde qui répond toutes les 15 s ;
- sur un navigateur neuf, les appareils du jeu de démonstration n'ont pas de `seen` (l. 791-799) :
  `ago(undefined)` renvoie **« il y a NaN j »** (l. 708-713).

C'est le seul indicateur de fraîcheur que l'utilisateur ait. Il ment exactement dans les cas de P1.
**Correction :** `d.seen = Date.now()` dans `pontApplique`, pour chaque appareil présent dans la
réponse et disponible. Et `ago` doit renvoyer « jamais » si `t` est absent.

### P3. Pendant une coupure du pont, la mémoire réelle disparaît de l'écran

`sondeReelle` (l. 873) exige `PONT.actif`. Pendant une coupure, avec un navigateur qui a un jeton et
9 jours de mesures dans `S.hist` : `reel` est faux, `estDemo` est faux et `PONT_LOCAL` est faux.
`segs` est donc vide. Il ne reste que le point « live » figé de P1, ou « Pas encore de mesure. » si
P1 est corrigé. La vignette se vide de la même façon (l. 1057).

C'est le défaut N4 du second rapport, qui passe de « sonde hors ligne » à « pont hors ligne ».
C'est honnête au sens où rien n'est inventé. Mais l'affichage dit « pas encore de mesure » alors que
les mesures sont là, et il les cache précisément quand on veut savoir depuis quand plus rien
n'arrive.

**Correction (déjà proposée au second rapport, N1) :** dans `sparkPath`, `tempCfg` et `humCfg`,
tester `histDe(b).length > 1` (avec, au besoin, la présence d'une sonde `eid` non `demo`), sans
condition sur `PONT.actif`. Garder `sondeReelle` (avec `PONT.actif`) pour
`enregistrerTemperatures` seulement.

### P4. Puissance des prises : la valeur inventée reste persistée

La l. 966 n'écrit plus `d.power` pour une entité `eid` hors maquette. C'est correct. Mais :
- un état existant garde le 160 W ou 410 W simulé, persisté. Prise allumée, le KPI « Puissance
  instantanée » et `live('dev:…')` l'affichent encore (l. 1278, 1299) ;
- sur un état neuf, `d.power` n'existe pas, donc on lit « — W ». C'est honnête, mais un peu
  maladroit.

La Meross MSS425F ne mesure pas la puissance (commit 0426676). **Correction :** au chargement, hors
maquette, `delete d.power` pour toute prise `eid`, et afficher « ON » ou « non mesurée » plutôt
qu'un nombre de watts.

### P5. Point d'amorce de `tempCfg` (N5)

```js
if (segs.length && segs[0].length < 2){
  const avant = hist.filter(p => p[0] < from);
  if (avant.length) segs[0].unshift([...]);              // l. 1099-1102
```

- **Il n'y a pas de test d'écart.** Le cas où la fenêtre ne contient qu'un point est justement
  celui d'un trou : par exemple, sonde morte pendant 3 jours puis revenue. On relie alors un point
  vieux de 3 jours au point actuel par un trait droit. C'est exactement ce que la découpe en
  segments devait empêcher. Il faut ajouter `from - avant.at(-1)[0] <= 2 * HIST_PAS`.
- **Le point est tracé hors cadre.** Son abscisse est antérieure à `x0: from`, et `drawChart`
  n'utilise aucun `clipPath` (l. 1020-1028). Le trait déborde donc sur la marge des graduations,
  ou part de la gauche hors de l'écran. L'aire de la dernière série (l. 1023) déborde aussi. Une
  correction possible : interpoler le point à `from`, ou ajouter un `clipPath` sur la zone de tracé.

### P6. Libellé de surveillance (§6 du premier rapport) : amélioré, pas réglé

« régulée par la page, coupée par le serveur 90 min après une commande automatique » (l. 1834).
La seconde moitié est désormais exacte. La première ne l'est toujours pas pour une prise `auto`
reliée :
- à un lot dont la sonde est hors ligne (`tp == null`, l. 940 : aucune régulation). C'est le cas
  du brief « pont actif sans donnée » (voir C) ;
- avec un pont injoignable, dans un onglet non maître, en `regulPause` ou en `regulRefus` ;
- à une prise **allumée ailleurs** alors qu'elle est en auto. La formulation « après une commande
  automatique » est techniquement juste : aucune commande automatique, donc aucune coupure. Mais il
  faut lire entre les lignes pour comprendre que la ceinture chauffe sans limite côté serveur.

De plus, « allumée à la main, personne ne la surveille » n'est **toujours pas en orange** :
l. 1813, `warn` ne couvre que `!online` ou `mode !== 'auto' && externe`. Dans « Appareils
reliés », le libellé n'a jamais de couleur d'alerte.

Ce point n'est pas bloquant à lui seul depuis la nouvelle formulation, mais c'est le dernier
affichage de sécurité inexact. La fonction `surveillance(d)` proposée au §6 du premier rapport
s'applique telle quelle.

### P7. Autres endroits où un lot réel montre autre chose que ses sondes

| Endroit | Ligne | Ce qui se passe | Gravité |
|---|---|---|---|
| Sonde ajoutée par « Ajouter un appareil » | 2103, 928 | Elle n'a pas d'`eid`, donc elle est **simulée par le modèle même hors maquette**. Reliée seule à un lot réel, la carte affiche le modèle. Reliée avec une vraie sonde qui décroche, `currentTemp` (l. 908) bascule sur elle, et `enregistrerTemperatures` **écrit la valeur simulée dans la mémoire réelle** (`sondeReelle` reste vrai grâce à l'autre sonde). | Moyenne (déjà signalé, N7 du second rapport) |
| « Activité récente » (`feedHTML`) | 1268, 1312 | Toujours non filtrée. Sur un navigateur neuf servi par le cluster, le générateur `heatSeeded` (l. 1250-1266) écrit 36 h de chauffes `sim` pour `o1`, `o2` et `o3`. Le fil affiche « Multiprise Tim Outlet 3 : désactivation de la chauffe à 60,x °C », c'est-à-dire le symptôme n° 2 mot pour mot, attribué à un vrai relais. Le journal du lot les filtre, le fil non. | Moyenne |
| `heatSeeded` modifie `d.on` | 1259 | Sur un navigateur neuf, il change l'état local de vraies prises (`o1` à `o3`). Le premier `pontSynchro` les marque alors `origine = 'externe'` à tort. C'est masqué par le libellé « lien de démonstration ». | Faible |
| `heater(b)` | 988, 1287 | Lit la **première** prise du lot. Dans la configuration du propriétaire (`b4` : `o3`, puis `o4`), « Chauffe active / Veille » montre l'état réel de `o3`, et pas celui de `o4` qui chauffe. Ce n'est plus de la simulation (N2 réglé), mais ce n'est pas la bonne prise. | Moyenne |
| `tempCfg.label` | 1123 | `reel && hist.length < 2` n'est toujours jamais vrai (N7 du second rapport). | Faible |
| `humCfg` | 1125-1138 | Pas de découpe des trous. Une humidité seule ne produit pas de mémoire. | Faible (déjà signalé) |
| Lot terminé : `currentTemp`, archive | 907, `archStats` | Le modèle (`model(b, b.end)`) reste utilisé. | Connu, assumé par le brief |

---

## C. Cas « pont actif, mais aucune donnée pour un appareil »

Le pont renvoie toujours **toute** sa liste blanche (`pont.py` l. 246-250). Une entité absente de
Home Assistant revient avec `disponible: False` et `valeur: None` (l. 213-223). Une entité
`unavailable` ou `unknown` revient avec `disponible: False` (l. 228). Les quatre sondes et les cinq
prises du dashboard figurent dans `PONT_SONDES` et `PONT_PRISES` (`k8s/deployment.yaml` l. 98-101).

Ce que voit l'utilisateur pour une **sonde** sans donnée :

| Élément | Affichage | Honnête ? |
|---|---|---|
| Appareils : mesure, état | « — », badge « Hors ligne » | ✅ |
| Appareils : « Dernière remontée » | Pas de `data-live` hors ligne, mais `ago(d.seen)` faux ou « NaN » (P2) | ❌ |
| Carte du lot : température | « — » (`currentTemp` vaut `null`) | ✅ |
| Badge d'état du lot | « **Sans sonde** » (l. 972) | ❌ La sonde est reliée, mais elle ne répond pas. Il faudrait « Sonde hors ligne ». |
| Écart à la cible | « **Aucune sonde reliée** » (l. 1289) | ❌ Même confusion. |
| KPI « Alertes » | Le lot **n'est pas compté** (`status` renvoie `''`, l. 1296) | ❌ Une sonde perdue sur un lot actif ne déclenche aucune alerte. C'est pourtant la situation où la régulation s'arrête. |
| Courbe | Mémoire affichée avec un trou, sans point « live » (N4 réglé) | ✅ |
| Prise `auto` du lot | Aucune commande, puisque `tp == null`. Libellé « régulée par la page… » | ❌ (P6). Si la prise était allumée, seuls `AUTO_MAX_ON` (si `regulDepuis` est posé) et la coupure du pont à 90 min l'arrêtent. Rien ne le signale. |

Pour une **prise** sans donnée : `online = false` et `d.on = false` (`etat` vaut « inconnu »,
l. 1360). On voit « — », « Hors ligne » et un bouton désactivé. C'est honnête. La seule réserve :
`d.on = false` est une supposition, alors que le relais peut être réellement allumé. Le libellé
« hors ligne » suffit à ne pas le prétendre éteint.

Cas limite : `disponible: True` avec un état non numérique (`valeur: None`). La l. 1367 ne met pas à
jour `d.value`, et `online` reste vrai. L'ancienne valeur est alors affichée **et réenregistrée dans
la mémoire toutes les 15 s** comme une mesure fraîche. C'est peu probable pour une sonde Sonoff, mais
`d.recu` (P1), posé seulement quand `valeur != null`, le règle aussi.

**En résumé, c'est honnête sur la mesure, mais pas sur l'alerte.** Il faut un statut « Sonde hors
ligne » de classe `bad`, compté dans le KPI des alertes.

---

## D. La maquette ouverte en local

J'ai vérifié chemin par chemin avec `PONT_LOCAL = true` et `PONT.actif` toujours faux
(`pontSynchro` sort l. 1375) :

- `tick` : le `continue` de la l. 924 ne s'applique pas. Toutes les sondes sont simulées, `seen` est
  rafraîchi et la puissance est simulée (l. 966). ✅
- Repli de régulation : bascule locale avec événement `sim` (l. 962). Le journal les accepte
  (`accepteSim`, l. 1683). ✅ Seule différence avec l'origine : le drapeau `sim` est posé. Il n'a
  aucun effet visible en local.
- Courbes, vignette, humidité : modèle (l. 1061, 1103, 1131). `S.hist` n'est jamais alimenté.
  L'origine `file://` a de toute façon son propre `localStorage`. ✅
- Clic sur une prise : bascule locale (l. 2069). ✅

**La maquette locale a bien retrouvé son comportement d'origine.**

---

## E. Invariants de sécurité

| Invariant | État |
|---|---|
| Rien ne peut allumer une prise | ✅ Aucun nouvel appel au pont. Hors maquette, la page ne modifie plus du tout l'état local d'une prise `eid` en dehors de `pontApplique` et `pontBascule`. C'est mieux qu'au second passage. |
| Freins `AUTO_COOLDOWN`, `AUTO_MAX_ON`, `AUTO_PAUSE`, `AUTO_REFUS` | ✅ Code inchangé (l. 937, 1454 et suivantes). La persistance est mieux protégée grâce à `save()` corrigé. |
| Marque `demo` | ✅ Aucun nouveau `delete d.demo`. |
| Contrat du pont (`auto: true` seulement depuis `regulerPont`) | ✅ Inchangé. |
| Affichage honnête de la surveillance | ⚠️ Amélioré, mais « régulée par la page » est encore affiché sans régulation, et l'orange manque (P6). |
| Affichage honnête de la mesure | ❌ Valeur figée présentée « En direct » sans pont (P1), fraîcheur cassée (P2). |

---

## Verdict

**Pas publiable en l'état, mais c'est la dernière marche.** Les défauts de fond des deux rapports
précédents sont réglés : mémoire, critère réel/démo, inondation du journal, `save()`. Les relais sont
plus sûrs qu'au départ. La maquette locale est intacte.

Ce qui bloque encore relève d'un seul problème : **la page ne sait pas dire qu'une valeur est
périmée.** Avant, la simulation masquait ce manque. Maintenant que la simulation se tait, il se
voit : 60,0 °C figé sur le navigateur de la capture, valeurs du jeu de démonstration sur un
téléphone, « En direct » en en-tête, « il y a NaN j » dans les appareils.

Corrections à faire avant publication (quelques lignes chacune) :

1. **P1 et P2** : `d.recu` et `d.seen` posés dans `pontApplique`. Hors maquette, une valeur `eid`
   jamais reçue ou plus vieille que 10 min s'affiche « — » et ne compte pas dans le statut.
   L'en-tête dit « Pont injoignable » au lieu de « En direct ». `ago()` gère un `t` absent.
2. **P4** : suppression au chargement de `d.power` des prises `eid`, et pas de watts affichés pour
   la Meross.
3. **C** : statut « Sonde hors ligne » de classe `bad`, compté dans les alertes. Libellés « Sans
   sonde » et « Aucune sonde reliée » réservés au cas où aucune sonde n'est reliée.

Souhaitables juste après, sans bloquer :

4. **P3** : afficher la mémoire dès que `histDe(b).length > 1`, pont actif ou non.
5. **P6** : `surveillance(d)` calculée (premier rapport, §6), et orange pour « personne ne la
   surveille ».
6. **P5** : point d'amorce limité à `2 * HIST_PAS`, et `clipPath` sur la zone de tracé.
7. **P7** : filtre `sim` sur « Activité récente », `heater(b)` sur la prise non `demo`, sonde `eid`
   explicite dans `currentTemp` pour la mémoire.
8. Régénérer `design/correctifs-diff.txt`, qui ne reflète pas ce passage.

Une fois les points 1 à 3 faits, je considère le dashboard publiable. Les points que le brief
assume (archive des événements non consultable, rétention de 9 jours, `b.mesures` non affiché, axe
vertical, survol limité à la première série) restent acceptables pour une première publication.
