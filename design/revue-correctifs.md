# Revue des correctifs — dashboard de fermentation (`scada-opus-5.5/hakko-dashboard.html`)

Relecture du diff `design/correctifs-diff.txt`, faite sur le fichier de travail actuel. Les numéros de
ligne renvoient au fichier **après** correctifs. Aucun fichier autre que ce rapport n'a été modifié.

## Résumé

Côté relais, les correctifs sont sûrs : aucun nouvel appel au pont, aucune décision de régulation
modifiée, aucune marque `demo` retirée. En revanche, **ils ne corrigent pas les deux symptômes
signalés** :

1. **La mémoire des mesures ne garde jamais plus d'un point** quand la synchro tourne normalement
   (toutes les 15 s) : la courbe d'un lot réel reste donc vide (bloquant, §1).
2. **Dans la configuration probable du propriétaire, le lot reste classé « démo »** : la courbe
   continue de tracer le modèle à 60 °C (bloquant, §3).
3. **Le générateur de faux événements « Désactivation de la chauffe » n'est pas celui qui a été
   corrigé.** La branche de repli de `tick()` (l. 893) en écrit encore à chaque démarrage de la page
   et à chaque coupure du pont, sans le drapeau `sim` (bloquant, §7).

**Verdict : à corriger avant publication.** La liste des corrections, par ordre de priorité, est en
fin de rapport.

---

## 1. Mémoire des mesures (`enregistrerTemperatures`, l. 835-849)

**Ce qui est correct**
- L'enregistrement se fait après `pontApplique` (l. 1290-1291), uniquement sur une synchro réussie :
  aucune valeur simulée ne peut entrer dans `S.hist` par ce chemin.
- `currentTemp(b) == null` (sonde hors ligne) ne produit pas de point. On n'invente donc pas de
  valeur pendant une panne.

**Ce qui est bloquant : le pas de 3 minutes ne fonctionne pas**

```js
if (dernier && t - dernier[0] < HIST_PAS){ h[h.length - 1] = [t, v]; return; }   // l. 844
```

Le dernier point est remplacé par `[t, v]`. Son horodatage avance donc à chaque synchro. La synchro
périodique a lieu toutes les 15 s (`setInterval` de 3 s, avec `ticPont % 5`, l. 2031), et l'écart
`t - dernier[0]` vaut alors toujours environ 15 s, donc moins de 180 s. **On ne pousse jamais de
second point.** Résultat :
- `hist.length` reste à 1 tant que l'onglet est au premier plan.
- `reel` vaut `false` dans `tempCfg` (l. 1010), et `!estDemo && h.length > 1` aussi dans `sparkPath`
  (l. 988).
- La courbe d'un lot réel ne montre qu'un point isolé : le point « live ». La sparkline n'est qu'un
  `M x y` sans segment, donc invisible.

Un deuxième point n'apparaît que si deux synchros sont espacées de plus de 3 minutes (onglet en
arrière-plan, mise en veille). L'historique obtenu est alors fait de trous et de points épars.

**Correction proposée** : ancrer le point sur le début de sa tranche et ne mettre à jour que la
valeur.

```js
const tranche = t => Math.floor(t / HIST_PAS);
if (dernier && tranche(dernier[0]) === tranche(t)){ dernier[1] = v; return; }
h.push([t, Math.round(v * 100) / 100]);
```

L'arrondi au centième réduit la taille du JSON : Home Assistant renvoie parfois beaucoup de
décimales. Si l'on préfère la moyenne de la tranche à la dernière valeur, il faut garder un compteur
dans le point (`[t, somme, n]`).

## 2. Croissance des données (`S.hist`, `HIST_MAX`, `save`)

**Ce qui est correct**
- Le plafond par lot existe, et `splice` le respecte (l. 846).
- Une fois le §1 corrigé, 4 320 points × environ 22 caractères (`[1790000000000,22.56],`) font
  environ 95 Ko par lot actif. Cinq lots actifs prennent environ 0,5 Mo, ce qui tient dans le quota
  de `localStorage` (environ 5 Mo par origine).

**Ce qui est risqué**
- **Aucune purge.** `S.hist[b.id]` survit à `finish` (l. 1921-1923) et à `delete-batch`
  (l. 1928 : le lot est retiré, son historique reste orphelin). Chaque lot réel laisse environ 95 Ko
  pour toujours. En quelques dizaines de lots, le quota est atteint.
- **Un dépassement de quota passe sous silence et touche la sécurité.** `save()` avale l'exception
  (l. 806). Une fois le quota plein, plus rien n'est persisté : ni les modes, ni les consignes, ni
  `regulDepuis`, `regulPause` ou `regulRefus`. Après un rechargement, la page repart d'un état ancien.
  Le chronomètre `AUTO_MAX_ON` et la pause `AUTO_PAUSE` peuvent être perdus. Le pont garde sa coupure
  à 90 min, mais la première ligne de défense est affaiblie, sans aucun message.
- **`save()` sérialise tout l'état toutes les 3 s** (l. 2031), plus à chaque synchro. Avec
  l'historique, on passe de quelques Ko à plusieurs centaines de Ko sérialisés en continu. C'est
  supportable, mais cela coûte en batterie sur téléphone.
- **9 jours, c'est court pour ces fermentations.** Une bière dure 21 jours, un miso 365. Avec la
  plage « Tout », la courbe commence là où la mémoire commence, et la mémoire ne remonte pas jusqu'au
  début du lot.

**Corrections proposées**
1. Au `finish`, résumer `S.hist[b.id]` (moyenne, min, max, pourcentage dans la plage, points
   sous-échantillonnés à environ 300) dans le lot lui-même (`b.mesures`), puis supprimer
   `S.hist[b.id]`. Ce résumé sert directement l'archive (voir §7.3). Au `delete-batch`, supprimer
   `S.hist[id]`. Au démarrage, supprimer les clés de `S.hist` qui ne correspondent à aucun lot actif.
2. Sous-échantillonner l'ancien au lieu de couper : 3 min sur les 48 dernières heures, 30 min
   au-delà. On couvre ainsi plusieurs mois pour une taille comparable.
3. Dans `save()`, en cas de `QuotaExceededError`, élaguer `S.hist`, réessayer, et en cas d'échec
   écrire une alerte visible (`logEvent('alert', …)`). Ne jamais échouer en silence.
4. Optionnel : stocker `S.hist` sous une clé `localStorage` séparée. Une saturation de l'historique
   ne bloquerait alors plus la sauvegarde de l'état de régulation.

## 3. Discriminant du lot réel (`estDemo`, l. 834)

**Ce qui est correct** : l'intention, c'est-à-dire réserver le modèle aux données de démonstration.

**Ce qui est bloquant : le critère porte sur les prises, pas sur la provenance de la mesure**

`estDemo(b)` est vrai dès qu'**un** appareil du lot porte `demo`. Or la marque `demo` n'est posée
que sur les prises `o1`, `o2` et `o3` (l. 795-797). Les sondes `s1`, `s2`, `s3` et `h1` sont de vraies
entités Home Assistant. Elles ne portent jamais `demo` et sont reliées aux mêmes lots.

- **Cas probable du propriétaire.** La consigne de 60 °C est celle du lot `b4`, « Garum de
  champignons » (l. 776), relié à `o3` (marquée `demo`). Le propriétaire a relié la prise 4 et la
  sonde 1 à ce lot. Le gestionnaire `assign` (l. 1958) retire `demo` **seulement sur l'appareil
  modifié**. Si `o3` est toujours reliée à `b4` (c'est l'état par défaut), `estDemo(b4)` reste vrai.
  La courbe trace encore le modèle, qui vaut 60 ± 0,5 °C (l. 826). Le journal montre encore les
  événements `sim`. Aucune mesure n'est enregistrée, puisque `enregistrerTemperatures` exclut les lots
  démo (l. 840). **Le symptôme n° 1 n'est pas corrigé dans ce cas.**
- Il en va de même pour `b1` (vraie sonde `s1` avec `o1` démo) et `b3` (vraies sondes `s3` et `h1`
  avec `o2` démo). Leur carte affiche la vraie sonde, mais leur courbe affiche le modèle.
- Inversement, un lot sans aucun appareil marqué est traité comme réel, même ouvert en `file://`.
  En maquette, `enregistrerTemperatures` n'est jamais appelée (elle ne l'est que dans
  `pontSynchro`), donc la courbe est vide. C'est une régression de la maquette pour `b2`.

**Correction proposée** : déduire le caractère réel de la **source de la température**, pas des
prises.

```js
/* La courbe est réelle si la température affichée vient d'une entité Home Assistant lue par le pont. */
const sondeReelle = b => PONT.actif && devsOf(b).some(d => d.kind === 'temp' && d.eid && !d.demo);
```

Utiliser `sondeReelle(b)` dans `tempCfg`, `sparkPath` et `enregistrerTemperatures`. Garder le
modèle seulement si `!PONT.actif` (maquette) ou si le lot n'a aucune sonde reliée au pont. Le journal
doit filtrer **par événement** et non par lot : n'afficher un événement `sim` que si `!PONT.actif`
(voir §7.1). Ainsi, une prise démo restée dans un lot réel ne fait plus basculer tout le lot.

## 4. Idempotence de la migration et données de l'utilisateur (l. 1134-1144)

**Ce qui est correct**
- Elle est rejouable sans perte. Le drapeau est posé en mémoire puis persisté au prochain `save()`
  (au plus 3 s). Si la page se ferme avant, l'état stocké est intact et la migration se rejoue à
  l'identique. Il n'y a pas de double archivage, puisque l'archive non sauvegardée est perdue avec
  le reste.
- Elle passe avant le générateur (l. 1145), donc un état neuf n'archive rien. Les nouveaux événements
  du générateur portent `sim` et ne seront jamais repris.
- Les événements de clic (`pontBascule`, l. 1329) ont `tp` indéfini. Ils ne sont pas touchés.

**Ce qui est risqué**
- **Elle archive aussi de vrais événements.** Le filtre `e.tp != null && !e.sim` attrape aussi les
  `logHeat` de `regulerPont` (l. 1364), c'est-à-dire les commandes **réellement envoyées** au relais
  avant le correctif. Le message « événements de chauffe fabriqués » (l. 1141) est alors faux pour
  ceux-là, et l'historique réel de régulation disparaît du journal.
- **L'archive n'est visible nulle part.** Aucune vue ne lit `S.eventsArchive`. « Archive
  conservée » ne veut dire que « encore dans le `localStorage` ».
- **Le drapeau peut manquer sur un état déjà migré.** Cela arrive avec un état restauré, copié d'un
  autre navigateur, ou si `S` est réinitialisé sans `migrationSim`. La migration archive alors les
  vraies commandes `regulerPont` passées depuis. Le risque est faible, mais la suppression est
  silencieuse.
- La note de migration n'a pas de lot (`b` indéfini). Elle n'apparaît que dans « Activité
  récente », jamais dans le journal du lot concerné.

**Corrections proposées**
- Marquer dès maintenant les événements de régulation réelle (`logHeat(..., {reel: true})` dans
  `regulerPont`). Le filtre de toute migration future devient alors `!e.sim && !e.reel`.
- Reformuler la note : « … événements de chauffe de provenance non vérifiable mis de côté (certains
  peuvent être de vraies commandes de régulation) ».
- Ajouter un moyen minimal de consulter ou restaurer `S.eventsArchive` (même un bouton
  « Réafficher » dans l'onglet Appareils), sinon le mot « conservée » ne tient pas.

**Lot dont la sonde est hors ligne une partie du temps**
- Les points manquent pendant la panne (c'est correct). Mais `drawChart` relie tous les points
  (l. 953). Un trou de 6 h devient un segment droit qui ressemble à une mesure. **Correction :**
  couper la série quand l'écart entre deux points dépasse `2 * HIST_PAS`, avec plusieurs `series`
  ou un `M` au lieu de `L`.
- Si le lot a deux sondes, `currentTemp` prend la première en ligne (l. 852). L'historique mélange
  alors deux sondes sans le dire. Il vaut mieux enregistrer l'identifiant de la sonde ou fixer une
  sonde principale.
- Si le pont tombe, les sondes réelles reçoivent des valeurs **simulées** (l. 864-868, voir §7.2). Ces
  valeurs n'entrent pas dans l'historique (bien), mais la carte et le statut les affichent.

## 5. Robustesse d'affichage

**`sparkPath` (l. 985-1003)**
- **Abscisses fausses (bloquant pour la sparkline).** La ligne 1001 calcule toujours `i / n * 100`
  avec `n = 48`. Avec l'historique réel, on a jusqu'à 480 points sur 24 h (3 min). Les points
  au-delà du 48e sortent du `viewBox` (x jusqu'à 1000) : on ne voit que les 2,4 premières heures de
  la journée, pas l'état actuel. Avec deux points, la courbe tient dans 2 % de la largeur.
  **Correction :** `const k = pts.length > 1 ? 100 / (pts.length - 1) : 0;` puis `i * k`.
- **Un seul point** : `M 0 y`, sans segment, est invisible. **Correction :** dupliquer le point
  (`pts.push(pts[0])`) pour tracer un palier, ou ne rien rendre.
- **Lot terminé** : la ligne 997 remplace le dernier point par `currentTemp(b)`, qui vaut
  `model(b, b.end).temp` pour un lot non actif (l. 851). **Le modèle parle encore** à la fin de la
  courbe d'un lot réel terminé. **Correction :** `if (b.status === 'active' && cur != null)`, comme
  dans `tempCfg`.
- Lot réel sans mesure depuis plus de 24 h : `h.slice(-2)` montre deux anciens points comme s'ils
  étaient récents (l'abscisse est l'indice, pas le temps). C'est un défaut mineur. On peut préférer
  ne rien afficher.

**`tempCfg` (l. 1006-1026)**
- Sans aucune mesure ni sonde en ligne, `pts` est vide et `drawChart` affiche « Pas encore de
  mesure. » (l. 931). C'est correct et honnête.
- Avec une sonde en ligne mais sans historique, on n'a qu'un point : un point « live » seul, sans
  message. Il vaudrait mieux afficher « Mémoire des mesures en cours de constitution » tant que
  `hist.length < 2`.
- La ligne 1015 a un repli fragile. Si la fenêtre contient exactement un point, `hist.slice(-2)`
  le repousse une deuxième fois (doublon). Si la fenêtre est vide, on ajoute deux points antérieurs à
  `from` : la vue « 24 h » peut alors s'étendre sur plusieurs jours, avec des libellés en heures,
  puisque `long` est calculé sur l'intervalle demandé et non sur l'intervalle tracé. **Correction :**
  n'ajouter que le dernier point antérieur à `from` s'il existe, et fixer `x0: from` dans la
  configuration retournée.
- **« Tout » sur un lot long** : au plus 4 320 points, donc environ 200 Ko d'objets recréés toutes
  les 3 s par `refreshLive` (l. 1204), plus un chemin SVG de 4 320 segments. C'est acceptable, mais
  inutile au-delà d'environ un point par 2 px. **Correction :** sous-échantillonner en min/max par
  colonne (environ 400 points) avant de construire `pts`. Le libellé « Tout » est trompeur tant que
  la rétention reste à 9 jours (§2).

## 6. Origine d'une prise et surveillance

**Ce qui est correct (sécurité)** : `origine`, `origineT` et `cmdT` sont purement descriptifs. Rien
dans `tick` ni dans `regulerPont` ne les lit. `pontApplique` n'envoie aucune commande.
`surveillanceTexte` est pure. Aucun de ces ajouts ne peut allumer une prise.

**Faux positifs « externe »**
- *Confirmation tardive de la multiprise Meross* : ce cas est couvert. `cmdT` est posé à la réponse
  du pont (l. 1328 et 1363). Les relectures à 1,5, 3,5 et 6 s, la relecture du pont (4 s) et la
  synchro périodique (15 s) tombent toutes bien avant 90 s. Une synchro lancée avant le clic et
  arrivée après est aussi couverte.
- *90 s, c'est trop large.* Le pire cas est d'environ 6 s + 4 s + 15 s, soit environ 25 s. Une
  fenêtre de 30 à 45 s suffit. Au-delà, un vrai changement extérieur juste après un clic (par
  exemple une automatisation Home Assistant qui recoupe la prise) est masqué.
- **Vrai faux positif :** la branche de repli de `tick` (l. 893, §7.1) modifie `d.on` **localement**,
  sans commande et sans `cmdT`. La synchro suivante voit `d.on !== etat` et marque `externe` une prise
  que personne n'a touchée. Cela arrive à chaque démarrage (`tick()` l. 2026, avant le premier
  `pontSynchro`), à chaque coupure du pont et dans tout onglet non maître.
- *Plusieurs navigateurs* : `S` est propre à chaque navigateur. Une prise régulée par le PC peut
  être en mode `manuel` dans l'état du téléphone. Le téléphone affiche alors « changée hors du
  dashboard, personne ne la surveille » alors que le PC la surveille. Il faut le documenter, ou
  formuler « changée hors de cette page ».

**`surveillanceTexte` (l. 1723-1730) : un libellé rassurant qui peut être faux (risqué pour la
sécurité)**
- `mode === 'auto' && d.batch` affiche toujours « régulée par la page, coupée par le serveur après
  90 min ». C'est faux dans plusieurs cas :
  - le lot est terminé (`tick` ne trouve pas de lot actif, l. 874) ;
  - le lot n'a aucune sonde en ligne (`tp == null`, l. 880) ;
  - le pont est injoignable ;
  - la régulation est en `regulPause` ou en `regulRefus` ;
  - **la prise a été allumée hors de la page alors qu'elle est en mode auto.** Dans ce dernier cas,
    le pont n'arme son échéance que sur `allume and auto` (`pont/pont.py:288-289`). Côté page,
    `regulDepuis` reste `null`, donc la coupure `AUTO_MAX_ON` (l. 877) ne s'applique pas. Si la
    température reste sous la consigne, `voulu === d.on` et aucune commande ne part. **La ceinture
    chauffe sans limite**, alors que l'écran promet une coupure à 90 min. C'est exactement le
    scénario de la prise 4 si on la passe en auto pendant qu'elle est allumée.
- `'allumée à la main, personne ne la surveille'` n'est **pas** en orange. La classe `warn` de la
  ligne 1705 ne couvre que `!online` et `externe`. Le brief demande l'orange « quand personne ».
- Une prise *éteinte* d'origine `externe` affiche « personne ne la surveille », en orange. C'est
  alarmant pour une prise à l'arrêt.
- Dans « Appareils reliés » (l. 1538), le libellé n'a jamais la couleur d'alerte.

**Corrections proposées**
1. `surveillanceTexte` doit renvoyer `{texte, alerte}` et calculer la vérité :

   ```js
   function surveillance(d){
     if (!d.online) return {texte:'hors ligne', alerte:true};
     if (d.demo) return {texte:'lien de démonstration, non régulée', alerte:false};
     const b = S.batches.find(x => x.id === d.batch && x.status === 'active');
     const regulee = d.mode === 'auto' && b && PONT.actif && currentTemp(b) != null && !(d.regulPause > now());
     if (regulee && (!d.on || d.regulDepuis)) return {texte:'régulée par la page, coupée par le serveur après 90 min', alerte:false};
     if (d.on) return {texte:d.origine === 'externe' ? 'allumée hors du dashboard, aucune coupure armée' : 'allumée à la main, personne ne la surveille', alerte:true};
     return {texte:'à l’arrêt', alerte:false};
   }
   ```

   Utiliser `alerte` aux lignes 1538 et 1705.
2. Dans `tick`, pour une prise `auto`, `on` et sans `regulDepuis`, démarrer le chronomètre
   (`d.regulDepuis = d.origineT || now()`). Ainsi, la coupure `AUTO_MAX_ON` couvre aussi une chauffe
   lancée ailleurs. Cela ne fait qu'**éteindre**, ce qui va dans le sens de la sécurité. Comme cela
   touche la régulation, il faut le valider séparément.
3. Réduire la fenêtre à 30-45 s, et ne plus faire modifier `d.on` par la branche de repli (§7.1).

## 7. Cohérence de l'ensemble : où le modèle parle encore

### 7.1 Faux événements de chauffe : la vraie source n'est pas corrigée (bloquant)

```js
if (PONT.actif && d.eid && maitreRegul && !d.demo) regulerPont(d, b, tp, voulu);
else { d.on = voulu; logHeat(d, b, tp, false); }        // l. 892-893
```

Le `else` s'exécute pour toute prise en mode auto dans trois cas :
- **au démarrage**, quand `tick()` (l. 2026) s'exécute avant que `pontSynchro` ait répondu, avec
  `PONT.actif = false` ;
- **pendant une coupure du pont** ;
- **dans un onglet non maître**, ainsi que pour les prises `demo` quand le pont est actif.

Il change `d.on` sans commander le relais et écrit un `heat-on` ou `heat-off` avec `tp` renseigné,
**sans `sim`**. Au démarrage, `tp` provient en plus de la simulation des sondes (§7.2), qui vaut
environ la consigne ± 0,5 °C. On obtient alors « Désactivation de la chauffe à 60,x °C » alors que
la prise est allumée et que le pont n'a rien reçu. C'est **exactement le symptôme n° 2**, et il
réapparaîtra après la migration. La migration n'agit qu'une fois, et `journalHTML` n'écarte que
`sim`.

**Correction :** dans ce `else`, ne simuler que si `!PONT.actif && PONT_LOCAL` (vraie maquette).
Dans tous les autres cas, ne rien faire : ni `d.on`, ni journal. Si on garde la simulation, appeler
`logHeat(d, b, tp, false, undefined, true)` pour marquer `sim`, et ne pas modifier `d.on` d'une
prise qui a un `eid`.

### 7.2 Valeurs de sonde simulées quand le pont ne répond pas encore

`tick` ne saute les appareils réels que si `PONT.actif && d.eid` (l. 864). Au démarrage et pendant
une coupure, la ligne 868 écrit `model(b, t).temp` dans `d.value` des **vraies** sondes. La carte du
haut, le statut (« Dans la cible »), les KPI d'écart et le `tp` de la régulation affichent alors le
modèle, persisté par `save()` toutes les 3 s.

**Correction :** `if (d.eid && !PONT_LOCAL) continue;`. Une entité réelle servie par le cluster ne
doit jamais recevoir de valeur simulée. Pendant une coupure, il vaut mieux afficher la dernière
valeur réelle, ou « — », avec l'âge de la mesure.

### 7.3 Autres endroits où le modèle parle encore pour un lot réel

| Endroit | Ligne | Ce qui est affiché | Correction |
|---|---|---|---|
| `humCfg` | 1027-1033 | Toute la courbe d'humidité vient du modèle, seul le dernier point est réel (koji réel avec la sonde `h1`). | Même mécanisme que `S.hist`, avec une série d'humidité, ou bien une courbe vide. |
| `currentTemp` et `currentHum` pour un lot terminé | 851, 856 | `model(b, b.end)` : température « finale » inventée. | Prendre la dernière mesure de l'historique ou du résumé (§2), sinon `null`. |
| `sparkPath` pour un lot terminé | 997 | Le dernier point est remplacé par le modèle. | Voir §5. |
| Archive : `archStats` et graphiques | 1752-1793 | Moyenne, min/max, « Dans la plage », **heures et nombre d'activations de chauffe** : tout est simulé, y compris pour un lot réel. Quand le propriétaire terminera son garum, l'archive annoncera environ 100 % dans la plage à 60 °C. | Calculer à partir du résumé `b.mesures` (§2) et des événements réels. À défaut, afficher « pas de mesures enregistrées ». |
| KPI « W consommés » et `live('dev:…')` d'une prise | 897, 1173, 1194 | `d.power` est écrit par la simulation (160 W ou 410 W) au démarrage ou pendant une coupure, puis n'est plus jamais mis à jour par le pont. La Meross MSS425F ne mesure pas la puissance (commit 0426676). Le dashboard affiche donc une **puissance inventée** et persistée. | Ne pas écrire `d.power` pour une entité `eid`. Afficher « — » ou « non mesurée ». |
| « Activité récente » (`feedHTML`) | 1163, 1463 | Non filtré : les événements `sim` et les faux événements du §7.1 y apparaissent. | Appliquer le même filtre que le journal. |
| KPI « Écarts de température » | 1191 | Correct quand le pont est actif (il passe par `currentTemp`), mais simulé au démarrage et pendant une coupure. | Corrigé par le §7.2. |

Après les corrections 1, 3, 7.1 et 7.2, la carte, la courbe et le journal d'un lot réel racontent
la même chose. Ce n'est **pas** le cas avec le diff tel quel.

## 8. Contrôle des invariants de sécurité demandés

| Invariant | État |
|---|---|
| Rien ne peut allumer une prise | ✅ Aucun nouvel appel `pontRequete`. `origine`, `cmdT` et `S.hist` ne pilotent aucune décision. |
| Freins `AUTO_COOLDOWN`, `AUTO_MAX_ON`, `AUTO_PAUSE`, `AUTO_REFUS` | ✅ Code intact (l. 1352-1356, 877). ⚠️ Indirect : un quota saturé par `S.hist` empêche de persister `regulDepuis` et `regulPause` (§2). |
| Marque `demo` | ✅ Aucun nouveau `delete d.demo`. Les seuls restent ceux d'`assign` et de `plug-mode` (l. 1958-1959). |
| Contrat du pont (`auto: true` seulement depuis `regulerPont`) | ✅ Inchangé (l. 1360). `pontBascule` n'envoie pas `auto` (l. 1309, 1316). |
| Affichage honnête de la surveillance | ❌ « coupée par le serveur après 90 min » est affiché alors que rien n'est armé (§6). |

## Verdict

**À corriger avant publication.** Le diff ne présente pas de danger pour les relais, mais il
n'atteint pas son objectif et ajoute un libellé de sécurité trompeur.

Corrections à faire, par priorité :

1. **§1** : le pas de l'historique (l. 844). Sans cela, aucune courbe réelle n'existe.
2. **§3** : le critère réel/démo fondé sur la sonde lue par le pont, et non sur la présence d'une
   prise `demo` (l. 834, 840, 988, 1010, 1575).
3. **§7.1 et §7.2** : arrêter la simulation et la fausse journalisation sur les entités réelles
   (l. 864-868, 892-893). C'est la vraie cause du symptôme n° 2.
4. **§6** : `surveillanceTexte` ne doit plus promettre une coupure non armée. Ajouter l'alerte
   orange pour « personne ne la surveille ». Idéalement, armer `AUTO_MAX_ON` pour une chauffe
   allumée ailleurs.
5. **§5** : abscisses de `sparkPath` (l. 1001) et garde `active` (l. 997).
6. **§2** : purge et résumé à la fin d'un lot, purge à la suppression, `save()` qui signale un
   quota plein.
7. **§4** : formulation de la note de migration, marquage `reel` des commandes de régulation,
   archive consultable.
8. **§7.3** : `humCfg`, archive, puissance affichée, fil d'activité.
