# Relecture n° 4 : la passe de corrections d'Opus (`corrections-opus-1`)

Fichier relu : `scada-opus-5.5/hakko-dashboard.html` (2 474 lignes), comparé à
`design/dashboard-apres-correctifs-1.html`. J'ai lu le rapport de l'auteur et le diff de la passe.
Je n'ai modifié que ce rapport. Les essais sont dans `C:\tmp\hakko-verif-4\`.

## Méthode

- **Lecture du code** : toutes les fonctions touchées par le diff, plus leurs appelants (`tick`,
  `finish`, `pontApplique`, `pontSynchro`, `regulerPont`, `regulerSecurite`, le routeur).
- **Exécution réelle** : Edge headless piloté par le protocole DevTools (`cdp.js`). Un petit
  serveur Node (`serveur.js`) sert le fichier, qu'il lit sans l'écrire. Il joue aussi le faux pont
  (`/api/etat`, `/api/prise`, avec un journal des commandes reçues). Il injecte en tête une horloge
  pilotable (`Date.now` décalable) et un capteur d'erreurs. Le mode `file://` a été ouvert sur le
  fichier lui-même, sans injection.
- **Compaction de la mémoire** : `compacterHist` et `decouper` sont extraites du fichier et
  éprouvées dans Node (`s3-compaction.js`).
- Scripts : `s1-regulation.js` (fraîcheur et régulation), `s2-journal.js` (journal, restauration,
  clavier), `s3-compaction.js`, `s4-axe.js` (axe vertical, `clipPath`), `s5-fichier.js` (maquette),
  `s6-statique.py` (CRLF, freins, syntaxe), `s7-contraste.js`, `s8-divers.js`.

**Aucune erreur JS ni rejet de promesse** dans mes scénarios, sauf l'exception que j'ai
provoquée volontairement (voir « Défaut antérieur à la passe »).

---

## Les mesures de l'assistant, revalidées

| Mesure de l'assistant | Mon verdict |
|---|---|
| `AUTO_*`, `regulerPont`, `regulerSecurite`, `regulMaitre` identiques au caractère près | **Exact, mais mal interprété.** Le texte est identique, et la boucle de décision de `tick` aussi (seule la ligne des watts change). Mais ce qui **alimente** les freins a changé : `currentTemp` exige maintenant une valeur fraîche venue d'une entité. Une sonde sans entité ou périmée ne pilote plus rien. `heatSeeded` ne touche plus `d.on`. « Freins identiques » ne veut donc pas dire « régulation inchangée ». Les changements vont tous dans le sens prudent (moins de commandes, jamais plus). Je les ai vérifiés à l'exécution plutôt que sur le texte (point 2). |
| Une seule commande dans six scénarios, par `regulerPont` avec `auto: true` | **Exact, mais insuffisant.** C'est une mesure d'absence : aucun des six scénarios ne passe par la coupure de sécurité ni par la clôture d'un lot pendant une chauffe. J'ai ajouté ces deux chemins. Sonde périmée : 2 commandes, toutes deux `auto: true` et émises par `regulerPont` (allumage, puis coupure de sécurité). Clôture : aucune commande, et c'est justement un problème (voir plus bas). Le fichier compte 3 appels à `pontRequete('prise'…)` : deux dans `pontBascule` (clic, avec une nouvelle tentative) et un dans `regulerPont`. Rien d'autre ne commande. |
| Valeur reçue il y a plus de 10 min : « — », lot en « Sans mesure » | **Confirmé** (S1 : à +9 min, `tp` = 20 ; à +11 min, `tp` = `null`, « Sans mesure », `bad`). |
| Restauration : 1 restauré, marqué, archive vidée, `S.events` = 501 | **Confirmé, et j'ai complété.** J'ai vérifié aussi que les 500 événements non restaurés gardés sont bien les 500 plus récents et que l'ordre reste décroissant (vrai dans les deux cas). Attention : le chiffre 501 apparaît **dès la restauration**, avant les 600 `logEvent`. La note écrite par la restauration chasse en silence la plus ancienne note réelle. C'est négligeable. |
| 4 800 points fins → 1 164 (188 horaires, 976 fins), « environ 4 704 relevés couverts » | **Mal formulé.** 4 800, c'est le nombre de **tranches** sur 10 jours. Le trou de 5 h en retire 100, donc il y a environ 4 700 **points**. `Σn` doit être égal **exactement** au nombre de points injectés, pas « environ ». Sur ma reproduction (4 700 points, trou de 5 h), `Σn` = 4 700 exactement. Aucun point n'est perdu. |
| « L'ancrage des points fins n'est pas respecté sur les points convertis » | **Mauvaise interprétation.** Avec des points de départ décalés de 77 s, les points **horaires** sont tous ancrés sur l'heure. Les points **fins** de moins de 48 h ne sont pas convertis : ils sont recopiés tels quels. Leur désalignement vient de l'entrée du test, pas de la compaction. Une vraie mémoire est toujours alignée, puisque `enregistrerTemperatures` écrit `trancheHist(t) * HIST_PAS`. Le défaut réel de la compaction est ailleurs : les trous (point 3). |
| 37 → 12 textes sous le seuil AA | **Ne peut pas être porté au crédit de la passe.** Aucune variable de couleur n'a changé, ni dans cette passe ni depuis l'origine : j'ai vérifié les deux diffs. La passe n'ajoute que des règles, avec des couples déjà présents. Une baisse du nombre d'échecs vient donc du **contenu affiché** (valeurs remplacées par « — », watts retirés, éléments absents), pas d'un meilleur contraste. Je l'ai constaté : entre pont muet et pont actif, ma liste change. Avec le pont actif apparaissent le badge « En ligne » à 4,49 et le bouton « ON » à 3,49, qui existaient déjà. Par ailleurs, `design/_mesures/sonde.js` **exclut tout texte SVG** (`el.closest('svg')`) : les graduations et le nouveau repère hors cadre n'étaient pas mesurés. Ma mesure les inclut : **aucun élément ajouté par la passe n'échoue** (`.mes-note`, `.ev-liste .fm`, `.sv-warn`, `#ev-msg`, badge « Sans nouvelles », `.hors-cadre`, dans les deux thèmes). Les échecs restants sont antérieurs : `.feed .fm` en `--faint` (2,54), `.nav-sec` et `.nav .cnt` en `#6F7885` (3,91), séparateur du fil d'Ariane (1,35), `.sync-txt` (4,43), `.o-btn` « ON » (3,49), `.badge.ok` (4,49). |
| 2 474 CRLF, zéro LF isolé | **Confirmé** (0 CR isolé, fichier terminé par CRLF). `node --check` passe sur les deux `<script>`. |
| `file://` : aucune erreur, courbes et cycles conservés | **Confirmé.** « Maquette locale », 4 vignettes sur 4 tracées, 23 chauffes simulées dans le fil, 11 dans le journal de b1, puissance « 582 W », surveillance « régulée par la simulation ». |

---

## 1. `logEvent` et `bornerEvents`

**Ce qui tient.**
- Le plafond est juste : 500 événements non restaurés, plus les restaurés. Les 500 gardés sont
  les plus récents, l'ordre reste décroissant, et la migration rejouée ne reprend pas un événement
  restauré (S2).
- Le tableau est réaffecté (`S.events = …filter`) au lieu d'être tronqué sur place. Aucun appelant
  ne garde une référence à l'ancien tableau : migration, restauration et `heatSeeded` réaffectent
  tous avant d'écrire.

**Ce qui est risqué.**
- Les événements restaurés sont **exemptés du plafond pour toujours**. Leur nombre reste borné par
  la taille de l'archive, puisque la migration ne s'exécute qu'une fois. Mais une archive de
  plusieurs centaines de chauffes fabriquées (36 h × 3 prises) restaurée d'un coup reste
  indéfiniment dans le stockage.
- Comme avant, le plafond supprime les événements anciens sans trace. Ce n'est pas nouveau.
- `logHeat` avec un horodatage (chemin de `heatSeeded`) fait un `push` sans borne. C'est antérieur
  et sans effet pratique : le `logEvent` suivant borne.

**Proposition.** Rien de bloquant. Si on veut borner les restaurés, on peut les plafonner à
part (par exemple 500), sans les mélanger au compte des événements vivants.

## 2. Fraîcheur contre régulation (le point le plus sensible)

**Vérifié à l'exécution (S1).** Prise réelle o4, en auto sur b1 (consigne 24 °C). La sonde
remonte 20 °C, puis devient « disponible sans valeur » :
- l'allumage part bien, et une seule fois (`auto: true`) ;
- de +11 à +44 min, `currentTemp` = `null`, aucune commande ne part, la surveillance dit « non
  régulée : aucune mesure de température récente » en orange, et le lot passe en « Sans mesure »
  (`bad`) ;
- à +46 min, la coupure de sécurité part (`allume:false, auto:true`) et la pause de 15 min
  s'affiche.

**La régulation ne commande donc jamais sur `null`** : `tick` teste `tp != null`, et la coupure
de sécurité, qui ne dépend pas de la température, fonctionne toujours. Sur `null`,
`regulerSecurite` journalise seulement une chauffe sans température. C'est sans danger.

**Ce qui est risqué.**
1. **Chauffe à l'aveugle jusqu'à 45 min.** Quand la sonde se tait alors que la prise est allumée,
   la page la laisse allumée jusqu'à `AUTO_MAX_ON` après la **dernière commande d'allumage**, pas
   après la perte de la mesure. Le serveur coupe de toute façon à 90 min. C'est le comportement
   d'avant, la passe ne l'aggrave pas. Mais c'est le vrai risque de ce lot, et le rapport de
   l'auteur ne le nomme pas.
2. **« Fraîche » veut dire « le pont a répondu », pas « la sonde a mesuré ».** `d.recu` est daté
   par la page à chaque réponse du pont. Le pont (`pont.py`) ne transmet pas le `last_updated` /
   `last_reported` de Home Assistant. Une sonde Zigbee à pile morte qui reste « available » dans
   HA, avec sa dernière valeur, sera jugée fraîche indéfiniment, et la régulation continuera sur
   une valeur figée. La phrase du rapport « une valeur figée ne passe plus pour une mesure en
   direct » n'est vraie que pour un **pont** figé, pas pour une **sonde** figée.
3. Pendant les 10 min qui suivent une coupure du pont, `fraiche()` ne lit pas `PONT.actif`. Les
   valeurs restent donc affichées alors que l'en-tête dit déjà « Pont injoignable ». C'est
   cohérent avec la règle des 10 min, mais un peu contradictoire à l'écran. La régulation, elle,
   s'arrête tout de suite (`PONT.actif` faux).

**Propositions.**
- Faire transmettre par le pont le `last_reported` de chaque entité, et calculer `fraiche()`
  dessus. Cela touche le pont, pas les freins.
- Couper dès que la mesure manque sur une prise allumée par la régulation, au lieu d'attendre
  `AUTO_MAX_ON`. Cela **touche les freins** : ce n'est pas à faire dans cette passe, mais c'est à
  décider par le propriétaire.

## 3. Compaction de la mémoire existante

**Ce qui tient (S3).**
- `Σn` est conservé exactement, la suite est strictement croissante, les heures sont ancrées sur
  `% HOUR`.
- L'opération est idempotente.
- Par heure, `min`, `max` et `n` sont exacts. La moyenne est exacte à l'arrondi `r2` près
  (0,005 °C). La moyenne pondérée globale (celle de `finish`) est égale à la moyenne brute.
- La fusion « horloge reculée » donne le bon `n`, la bonne moyenne pondérée et le bon `max`.
- **Le chemin réel** (compaction à chaque nouvelle tranche) donne **exactement** le même résultat
  qu'une compaction en un coup. La mémoire existante est donc bien convertie d'elle-même.

**Ce qui ne tient pas : oui, un trou de sonde peut être comblé par une heure regroupée.**
`decouper` tolère deux pas, soit 2 h au niveau horaire. Deux heures pleines consécutives sont
espacées de 1 h. Une heure **entièrement vide** donne donc un écart de 2 h, qui n'est pas
supérieur à 2 h : la courbe reste reliée.
- Mesuré : un trou de **2 h 54** donne 2 segments au niveau fin, mais **1 seul** après compaction.
  Un trou de 1 h 10 est lui aussi relié par un trait.
- À la jonction de la limite des 48 h, un trou de 1 h 40 reste visible : 2 segments.

Le brief de la passe voulait justement qu'une coupure de sonde ne ressemble pas à une mesure.

**Autres points mineurs.**
- La moyenne horaire est tracée au **début** de l'heure, ce qui décale la courbe de 30 min.
- À la fusion, l'humidité suppose que tous les `n` du point précédent avaient une humidité. Le
  poids est donc légèrement faux si seule une partie en avait.

**Proposition.** Au niveau horaire, couper dès que l'écart dépasse **un** pas : remplacer
`> 2 * pasDe(prev)` par `> pasDe(prev)` quand `prev` est un point horaire, en gardant deux pas
pour le niveau fin. Une heure entièrement manquante interrompra alors la courbe. On peut aussi
couper sur un `n` trop faible (heure à moitié vide).

## 4. Identifiants SVG (`clipPath`)

**Ce qui tient.** Chaque élément reçoit son `id` d'un compteur global (`clip-N`), mémorisé sur
l'élément. Il est réutilisé quand on redessine et il est unique sur la page. Sur l'archive, avec
deux graphiques, après `render()` et un changement de thème, j'obtiens `clip-5` et `clip-6` :
uniques, et chaque `url(#…)` pointe vers un élément existant. La vue téléphone n'est qu'une classe
CSS sur le même DOM, sans clonage ni `iframe`. Il n'y a pas de `<base>` dans la page. La courbe
de densité garde ses points et sa ligne visée.

**Risque résiduel.** Les `id` ne sont pas préfixés. Ce n'est un problème que si la page était un
jour incluse deux fois dans un même document, ce qui n'est pas le cas.

## 5. Règle de l'axe vertical

**Vérifié (S4).**

| Cas | Résultat |
|---|---|
| Mesures 23 °C ±0,02, cible 60 | graduations 22,5 / 23,0 / 23,5 ; repère « ▲ cible 60 °C, 37,0 °C plus haut », aussi dans l'`aria-label` ; vignette sans consigne |
| Cible à 3 °C | consigne dans le cadre |
| Cible à 5,1 °C, étendue 1 | consigne dans le cadre (5,1 ≤ 3 × étendue après `ecartMin`) |
| Mesures 22 → 25, cible 33 | consigne dans le cadre (8 ≤ 9) |
| « Tout » | même règle, sur toute la durée |
| Lot terminé | non concerné : l'archive n'a pas de ligne « souple », la consigne reste toujours dans le cadre, comme avant |

La règle est cohérente entre la grande courbe et la vignette.

**Ce qui est faux ou trompeur.**
1. **Le repère arrondit la cible.** Pour une cible de 18,5 °C avec des mesures à 30 °C, il
   affiche « ▼ cible **19** °C, 11,5 °C plus bas ». L'écart est calculé sur 18,5, le libellé
   dit 19 : les deux chiffres se contredisent. La même chose vaut pour le libellé dans le cadre
   (« cible 28 °C » pour 28,1). `fmt(tg, 0)` est antérieur, mais la passe le met maintenant dans
   une phrase chiffrée.
2. **« Pas encore de mesure. »** s'affiche en plage 24 h quand la mémoire existe mais date de plus
   de 24 h (pont coupé depuis 30 h). C'est faux : il y a des mesures, la plage « Tout » les
   montre. Ce cas est nouveau, puisque P3 garde la mémoire pendant une coupure.
3. Quand le pont est muet, l'écart du repère est calculé sur le **dernier point mémorisé**, qui
   peut avoir des heures, sans que ce soit dit.
4. Quand la consigne est hors du cadre, la plage tolérée n'est pas tracée, mais la légende
   annonce toujours « Consigne » et « Plage tolérée ».
5. « Mesures écartées » : les points hors de la fenêtre ne comptent pas dans l'étendue. Le point
   d'amorce interpolé, lui, compte. C'est voulu et sans effet notable.

**Propositions.**
- Libellé avec `fmt(tg, 1)` quand la consigne n'est pas entière.
- Remplacer « Pas encore de mesure » par « Aucune mesure sur les dernières 24 h, dernière le … »
  quand `histDe(b)` n'est pas vide.
- Ajouter « (dernière mesure HH:MM) » au repère quand `cur` est `null`.

## 6. La boîte des événements restaurés

**Clavier et focus (S2).**
- Ouverture à la touche Entrée depuis le bouton « Mis de côté » : la boîte s'ouvre, le focus est
  sur « Tout sélectionner ».
- Liste triée du plus récent au plus ancien.
- « Restaurer la sélection » sans rien cocher : le focus va sur le message « Cochez au moins un
  événement à restaurer. ».
- Après une restauration, le focus va sur « 1 événement restauré dans le journal. ».
- Échap ferme la boîte.

**Problèmes d'accessibilité.**
- **Après la fermeture, le focus tombe sur `body`.** La restauration appelle `render()`, qui
  détruit le bouton d'origine (il disparaît même tout à fait quand l'archive est vide). Le
  `<dialog>` natif n'a donc plus rien à qui rendre le focus.
- La zone `role="status"` est recréée avec son texte déjà dedans (`innerHTML`). Beaucoup de
  lecteurs d'écran n'annoncent pas une région live qui naît pleine. La prise de focus compense.
- « Tout sélectionner » ne reflète pas une sélection partielle (pas d'état `indeterminate`).

**La question de fond : un événement fabriqué restauré peut-il repasser pour une commande
réelle ? Oui, dans le fil « Activité récente ».**
- Le journal du lot l'affiche correctement : « Activation de la chauffe (restauré, provenance non
  vérifiée) ».
- Mais `feedHTML` n'affiche que `e.x`. Le fil montre donc « Multiprise Tim Outlet 1 : activation
  de la chauffe à 23,1 °C », **sans aucune marque**, exactement comme une vraie commande (S2).
- Le texte de la boîte promet pourtant : « Restaurées, elles reviennent **dans l'activité** et
  dans le journal de leur lot, **marquées comme non vérifiées** ». Pour l'activité, c'est faux.
- « Tout restaurer » est **irréversible** : il n'existe aucun chemin pour remettre un événement de
  côté. Le bouton est le bouton principal et n'a pas de confirmation.

La restauration n'a **aucun effet sur la régulation** : rien ne lit les événements pour décider.
`surveillance` lit `d.origine` et l'archive lit le modèle. Le risque est seulement celui d'un
journal mensonger, mais c'est exactement celui que la migration voulait supprimer.

**Propositions.**
- Dans `feedHTML`, suffixer « (restauré, non vérifié) » quand `e.restaure`. C'est une ligne.
- Ajouter un `confirm()` sur « Tout restaurer », qui dit que l'opération est définitive.
- Après la fermeture, rendre le focus au bouton « Mis de côté » s'il existe encore, sinon au
  titre « Activité récente » ou au `h1` de l'Archive.

## 7. Ce que la passe casse ailleurs

Vérifié sans régression :
- **Archive** : axe inchangé, carte « Mesures relevées » avec `n` pondéré.
- **`gravCfg`** : points, ligne visée, `clipPath`.
- **Fil d'activité** : `evVisible`, les 23 chauffes simulées sont cachées hors maquette et
  visibles en `file://`.
- **En-tête** : « En direct » tant que le pont répond, même quand une sonde est périmée (c'est
  juste). Témoin éteint et « Pont injoignable, dernière synchro … » quand il ne répond plus.
- **`etatBadge`** et le rafraîchissement par `data-etat`.
- **`ago()`** : « jamais » au lieu de « NaN ».

Effets de bord à connaître :
- **Une sonde ajoutée à la main** (sans entité) est désormais, hors maquette, « Sans nouvelles »
  **pour toujours**. Elle compte dans « sans remontée récente », et le lot auquel elle est reliée
  passe en alerte « Sans mesure » s'il n'a pas d'autre sonde. C'est logique, puisque rien ne la
  mesure. Mais « Sans nouvelles » laisse croire qu'elle en a déjà eu, et la boîte « Ajouter un
  appareil » propose toujours d'en créer. Il faudrait au minimum un libellé « Non reliée à Home
  Assistant ».
- **« Dernière remontée »** affiche « jamais » pour toutes les sondes tant que le pont n'a pas
  répondu dans cet onglet, même si elles remontent depuis des mois. C'est vrai du point de vue de
  la page, mais surprenant.
- **Dépendance externe** : la page charge IBM Plex depuis Google Fonts. C'est antérieur, déjà
  présent dans la référence, et la page a une police de repli. Je le signale parce que les lignes
  rouges disent « sans dépendance ».

---

## Défaut antérieur à la passe, mais grave : « Terminer le lot » pendant une chauffe

Ce défaut n'est pas introduit par cette passe : `finish`, `regulerSecurite` et `currentTemp(b)`
sur un lot absent ont le même comportement dans la référence. Je l'ai trouvé en éprouvant le
point 2, et il touche directement la sûreté.

Reproduit (S1-bis) :
1. La régulation allume o4 (`regulDepuis` est posé).
2. L'utilisateur clique « Terminer le lot ». `finish` met `d.batch = null` et `d.on = false`
   **localement**, sans envoyer de commande : **le relais reste allumé**. `regulDepuis` est
   conservé.
3. À la synchro suivante, le pont renvoie `on`. La page affiche alors la prise « allumée hors du
   dashboard » (`origine: 'externe'`).
4. À `AUTO_MAX_ON`, `tick` appelle `regulerSecurite(d, undefined)`. Cette fonction remet
   `regulDepuis` à `null`, **puis** lève `TypeError: Cannot read properties of undefined
   (reading 'status')` dans `currentTemp(b)`. **La coupure de sécurité de la page ne part
   jamais.** Seul le chien de garde du serveur (90 min) coupera. En outre, l'exception interrompt
   ce tour de `tick` pour les prises suivantes, ainsi que `save()` et `refreshLive()` de ce cycle.

Le gestionnaire « assign » (délier une prise allumée) suit très probablement le même chemin
(`d.batch = null; d.on = false`). Je ne l'ai pas exécuté.

**Proposition, à faire décider par le propriétaire.** Toutes les corrections touchent soit les
freins, soit la règle « une commande seulement sur un clic » :
- protéger `regulerSecurite` contre un lot absent (`b ? currentTemp(b) : null`) ;
- ou faire envoyer à « Terminer le lot » un OFF explicite pour les prises réelles allumées par la
  régulation. Le clic « Terminer » est un clic de l'utilisateur, mais la boîte de confirmation
  doit alors le dire.

---

## Ce que je n'ai pas pu vérifier

- **Le matériel réel** : Home Assistant, la Meross, et le chien de garde de 90 min du pont. J'ai
  lu ce dernier dans les textes de la page, sans l'exécuter.
- **Un lecteur d'écran réel** : l'annonce de `role="status"`, la lecture de la boîte. Je n'ai
  testé que le focus et le clavier.
- **Le comportement en conditions réelles** de la règle « 10 min » contre une sonde Zigbee figée.
  Ma conclusion vient du code de `pont.py`, qui n'envoie pas `last_updated`.
- **La reproduction exacte des chiffres 37 et 12** : je n'ai pas le script de l'assistant pour
  cette mesure (la sonde de `design/_mesures/` vise la maquette). Ma méthode compte autrement
  (par route, SVG compris), donc mes chiffres absolus ne sont pas comparables. Seule la
  conclusion qualitative l'est : la passe n'ajoute aucun échec.
- **Le gestionnaire « assign »** sur une prise allumée par la régulation (déduit du code, non
  exécuté).
- **Safari et Firefox** : seul Edge (Chromium 154) a été utilisé.

## Verdict

**À corriger avant publication, mais les corrections sont courtes.** Aucune ligne rouge n'est
franchie :
- le fichier reste unique ;
- `file://` fonctionne ;
- les freins sont identiques au caractère près ;
- il y a toujours 2 `delete d.demo` et 3 `demo:true` ;
- aucune commande ne part en dehors d'un clic ou de `regulerPont` ;
- aucune commande sur une valeur `null`.

L'essentiel du lot tient à l'exécution : fraîcheur, mémoire à deux niveaux, survol, journal borné.

À faire avant de publier (affichage seulement, sans toucher la régulation) :
1. **Marquer les événements restaurés dans le fil « Activité récente »** (`feedHTML`), et
   demander confirmation pour « Tout restaurer ». Sans cela, la boîte affiche une promesse fausse
   et ramène des chauffes fabriquées sous l'apparence de commandes réelles.
2. **Couper la courbe sur une heure manquante** au niveau horaire (`decouper`). Aujourd'hui, un
   trou de près de 3 h est tracé comme une mesure.

À faire ensuite (mineur) :
- l'arrondi de la cible dans le repère ;
- « Pas encore de mesure » quand la mémoire a plus de 24 h ;
- le retour du focus après la boîte de dialogue ;
- le libellé des sondes sans entité.

À traiter à part, et vite : le défaut antérieur de « Terminer le lot » pendant une chauffe, qui
neutralise la coupure de sécurité de la page. La fraîcheur devrait aussi être calculée sur
l'horodatage Home Assistant plutôt que sur la réponse du pont. Ces deux sujets touchent la
régulation ou le pont : ils relèvent d'une décision du propriétaire, pas de cette passe.
