# Corrections Opus n° 1 : `scada-opus-5.5/hakko-dashboard.html`

Ce rapport répond à `design/brief-corrections-opus-1.md`, section « Corrections demandées », points 1 à 6.
Les numéros de ligne renvoient au fichier livré, qui compte 2 474 lignes en CRLF. La référence de
comparaison est `design/dashboard-apres-correctifs-1.html` (+438 / −116 lignes).
J'ai modifié deux fichiers : le dashboard et ce rapport. Les scripts de test sont restés hors du
dépôt, dans `C:\tmp\hakko-verif\`.

## Ce que j'ai vérifié moi-même

1. **Syntaxe.** J'ai extrait les deux `<script>` du fichier et passé chacun à `node --check` :
   les deux passent. Le fichier compte 2 474 CRLF et aucun LF isolé.
2. **Exécution dans un vrai navigateur.** J'ai utilisé Edge headless avec `--virtual-time-budget`.
   La page est servie en HTTP par un petit serveur Node qui joue aussi le faux pont (`/api/etat`
   et `/api/prise`). L'instrumentation est injectée à la volée et le fichier sur disque n'est pas
   modifié. J'ai fait tourner six scénarios, **sans aucune erreur JS ni rejet de promesse
   non traité** :
   - **A.** Navigateur neuf, pont injoignable (le cas de la capture d'écran) ;
   - **B.** Navigateur neuf, pont actif, sonde 2 indisponible ;
   - **C.** Mémoire à deux niveaux, axe, survol, amorce, restauration des événements, archive ;
   - **D.** Maquette ouverte en `file://` ;
   - **E.** Régulation d'une vraie prise (o4 sans marque `demo`, en auto sur b1) ;
   - **F.** Coupure du pont après des mesures, puis 11 minutes sans rien.
3. **Freins intacts.** J'ai comparé, sans tenir compte des fins de ligne, `AUTO_*`,
   `regulMaitre`, `regulerPont`, `regulerSecurite` et la boucle de décision de `tick` avec la
   sauvegarde. Ils sont **identiques au caractère près**. Les deux `delete d.demo` d'origine sont
   toujours là et je n'en ai ajouté aucun. Le seul `auto: true` est celui de `regulerPont`
   (l. 1698).
4. **Commandes envoyées.** Sur les six scénarios, le faux pont n'a reçu **qu'une seule** commande.
   Elle vient de la régulation dans le scénario E : `{"entite":"…outlet_4","allume":true,"auto":true}`.
   Aucune commande ne part de l'affichage, de la restauration ou de la clôture d'un lot.

Je n'ai pas mesuré les contrastes ni le parcours clavier avec un outil. Les nouveaux éléments
n'utilisent que des couples de couleurs déjà présents : `--muted`, `--warn`, `--ink2` sur
`--surface`, et les badges `warn` et `bad` existants.

---

## 1. Événements mis de côté (`S.eventsArchive`)

**Ce que j'ai fait.**
- Un bouton sobre « Mis de côté N » apparaît dans l'en-tête de la carte « Activité récente »
  (l. 1802), et « Événements mis de côté N » dans l'en-tête de la page Archive (l. 2216-2218).
  Les deux ne s'affichent que si l'archive n'est pas vide.
- Le bouton ouvre une boîte de dialogue, dans le `<dialog>` existant (`openArchiveEvents`,
  l. 2116). Elle contient :
  - une phrase d'explication ;
  - la liste triée du plus récent au plus ancien (texte, date, lot), avec une case à cocher par
    événement et « Tout sélectionner » ;
  - les boutons « Restaurer la sélection » et « Tout restaurer » ;
  - un message de résultat (`role="status"`, qui reçoit le focus).
- `restaurerEvenements` (l. 2132) remet les événements dans `S.events`, triés, et les marque
  `restaure: true`. Il écrit aussi une note au journal. Gestionnaires : l. 2374-2383. CSS :
  l. 651-659.
- **La migration ne les reprend plus.** Son filtre exclut désormais `e.restaure` (l. 1426).
- **Le plafond du journal ne les chasse pas.** C'est un point que le brief ne mentionnait pas.
  Le journal garde les 500 événements les plus récents. Les événements restaurés sont anciens
  par nature : le premier `logEvent` suivant les aurait supprimés, et la restauration n'aurait
  servi à rien. `bornerEvents` (l. 1400) applique le plafond de 500 sans compter les événements
  restaurés. Il remplace les deux `S.events.length = Math.min(…, 500)`.
- Dans le journal du lot, un événement restauré affiche « (restauré, provenance non vérifiée) »
  (l. 1930).

**Vérifié (scénario C).**
- Le bouton est présent, la boîte s'ouvre et liste 2 événements.
- Après restauration d'un seul : il reste 1 événement dans l'archive et 1 dans `S.events`.
- L'événement restauré est toujours là après 600 `logEvent` (`S.events.length` = 501).
- Il est exclu si la migration est rejouée, et le journal du lot affiche bien « restauré ».

**Non fait.** Pas de suppression définitive depuis la boîte de dialogue : le brief ne la demande
pas, et je préfère ne pas l'ajouter sans qu'elle ait été demandée.

## 2. Mémoire des mesures à deux niveaux

**Ce que j'ai fait (l. 911-966).**
- **Niveau fin.** Un point par tranche de 3 min (`HIST_PAS`), conservé sur les 48 dernières
  heures (`HIST_FIN`).
- **Niveau large.** Au-delà de 48 h, un point par heure (`HIST_PAS_LARGE`), au format
  `[début de l'heure, moyenne, humidité moyenne, min, max, n]`. `n` compte les tranches résumées,
  ce qui garde le minimum, le maximum et une moyenne pondérée exacte.
- **`HIST_MAX` reste à 4 320 points**, soit 960 points fins + 3 360 heures ≈ **142 jours**, au lieu
  de 9. Cela couvre une bière, un koji et un garum, et environ 4,7 mois de miso.
- `compacterHist` est appelée à chaque nouvelle tranche (l. 993). Elle ne regroupe que les heures
  **entièrement** passées sous la limite des 48 h, chacune une seule fois. L'horodatage reste ancré
  sur le début de l'heure et la suite reste strictement croissante. Si une heure déjà regroupée
  reçoit encore des points fins (horloge déplacée), ils sont fusionnés et non dupliqués.
- La mémoire existante (9 jours de points fins) est convertie d'elle-même dès la première tranche
  enregistrée.
- `decouper` (l. 955) découpe les trous avec une tolérance de deux pas : 6 min pour un point fin,
  2 h pour un point horaire. Avec l'ancien seuil fixe de 6 min, chaque point horaire serait devenu
  un segment isolé.

**Vérifié (scénario C).** Entrée : 10 jours de points fins (4 701), avec un trou de 5 h il y a
4 jours. Après compaction :
- il reste 1 160 points : 188 horaires et 972 fins, tous de moins de 49 h ;
- la suite est strictement croissante ;
- l'ancrage est respecté : les points horaires sont sur `% HOUR`, les fins sur `% HIST_PAS` ;
- `Σn` vaut toujours 4 701 ;
- l'opération est idempotente ;
- `decouper` trouve exactement 2 segments, c'est-à-dire le trou.

**Choix assumé.** Pour un an complet de miso, il faudrait un pas de 2 h (≈ 9 mois) ou un troisième
niveau. J'ai préféré une résolution horaire, qui reste lisible sur le cycle jour/nuit. C'est une
seule constante à changer.

## 3. Résumé de fin de lot dans l'Archive

**Ce que j'ai fait.**
- Nouvelle carte « Mesures relevées » en tête de la colonne latérale de l'archive, à côté des deux
  courbes (l. 2264-2280, insérée l. 2293). Elle montre :
  - le nombre de relevés, la moyenne, le minimum et le maximum ;
  - l'écart moyen à la consigne finale ;
  - la période couverte.
- Une phrase précise que ce sont les relevés de la sonde, et que les courbes voisines sont
  reconstituées par le modèle (c'est le cas : `archStats` utilise `model`). Sans `b.mesures`, la
  carte dit qu'aucune mesure réelle n'a été enregistrée.
- `finish` calcule désormais un résumé correct sur les deux niveaux (l. 2343-2350) : moyenne
  pondérée par `n`, min et max des points horaires, et ajout de `debut`/`fin`. Un ancien
  `b.mesures` sans `debut` s'affiche sans la ligne « Période couverte ».

**Vérifié (scénario C).** Après « Terminer le lot » sur 10 jours de mémoire : `n` = 4 701,
moyenne 23,0 °C, min 22,8, max 23,2, et la carte affiche ces valeurs.

**Non fait.** La colonne « Temp. moyenne » de la liste de l'Archive reste calculée sur le modèle.
Le brief demandait la vue Archive « à côté des courbes », c'est-à-dire la page de détail.

## 4. Axe vertical de la courbe de température : mon choix

**Le problème.** Si l'axe inclut toujours la consigne, une eau à 23 °C visée à 60 °C donne une
courbe plate en bas du cadre. Mais exclure la consigne en silence masquerait la distance à la
cible.

**Le choix (`drawChart`, l. 1116-1166).**
- L'axe part des **mesures**, avec une étendue minimale de 1 °C (`ecartMin`). Ainsi, le bruit de
  quelques centièmes d'une sonde ne remplit pas toute la hauteur.
- La consigne, marquée `souple`, entre dans le cadre si elle est **à moins de 5 °C** des mesures
  (`proche`), **ou** si l'y faire entrer laisse **au moins un quart de la hauteur** aux mesures.
  En pratique : distance ≤ 3 × étendue des mesures.
- Sinon, la consigne reste hors du cadre, et un **repère au bord** dit où elle est et à quelle
  distance : « ▲ cible 60 °C, 37,0 °C plus haut ». La même phrase est ajoutée à l'`aria-label`
  du graphique. La plage tolérée suit la consigne : elle n'élargit l'axe que si la consigne est
  dans le cadre, et elle est tracée bornée au cadre.

**Pourquoi c'est honnête.** Les graduations restent vraies. La distance à la cible est écrite en
clair, et elle figure aussi dans l'indicateur « Température » (« −37,0 °C vs cible »). Aucune
échelle cassée ne fait croire que la cible est proche. Dès que le lot approche de sa consigne
(moins de 5 °C), la ligne revient dans le cadre.

La vignette des cartes suit la même règle (l. 1227-1241). Sans repère textuel, puisqu'elle n'a
pas d'axe, mais la cible est affichée juste au-dessus d'elle, dans la carte.

**Vérifié (scénario C).** Lot réglé à 60 °C avec une mémoire à 23 °C : graduations 22,5° / 23,0° /
23,5°, pas de ligne « cible » dans le cadre, repère « ▲ cible 60 °C, 37,0 °C plus haut », présent
aussi dans l'`aria-label`.

**Effet sur les autres graphiques.** Aucun : seule la ligne de `tempCfg` est marquée `souple`.
L'humidité, la densité et l'archive gardent l'ancien comportement.

## 5. Survol d'un graphique découpé

**Ce que j'ai fait.**
- `drawChart` lit maintenant **toutes** les séries marquées `survol`, à la suite et dans l'ordre
  chronologique, au lieu de `series[0]` seule (l. 1180-1185). Les segments de `tempCfg` et de
  `humCfg` portent cette marque. Sans marque, le comportement reste celui d'avant (première
  série), ce qui garde l'archive juste : la moyenne seule, et non les courbes min et max.
- Ajout d'un `clipPath` sur la zone de tracé, avec 6 px de marge pour le point « live » (l. 1166).

**Vérifié (scénario C).** Survol au milieu du **dernier** segment : la bulle affiche exactement
la valeur et l'heure du point visé. Le survol lit 1 142 points, autant que la somme des segments.

## 6. Points P1 à P7 de `design/revue-correctifs-3.md`

### P1 : une valeur figée ne passe plus pour une mesure en direct
- `pontApplique` pose `d.recu` et `d.seen` pour chaque appareil présent dans la réponse
  (l. 1586-1588) :
  - pour une prise : si elle est disponible ;
  - pour une sonde : si elle est disponible **et** que sa valeur est numérique (cas limite C de
    la revue).
  Elle pose aussi `PONT.recu` (l. 1603).
- `fraiche(d)` (l. 905) : hors maquette, une valeur sans `d.recu`, ou reçue il y a plus de
  10 min (`FRAICHEUR`), est traitée comme absente. Cela couvre aussi les valeurs de démonstration
  et l'ancien « 60,0 °C » persisté, **sans migration**.
- Conséquences :
  - `currentTemp`/`currentHum` renvoient `null` (l. 1001-1010) ;
  - `live('dev:…')` affiche « — » (l. 1466) ;
  - le lot affiche « Sans mesure » ou « Sonde hors ligne », en classe `bad` (l. 1075) ;
  - aucun point « live » n'est tracé (`live: … && cur != null`) ;
  - l'indicateur « Appareils en ligne » ne compte que les valeurs fraîches ;
  - un badge « Sans nouvelles » apparaît dans Appareils, mis à jour en direct via `data-etat`
    (l. 1504, 1522, 2036).
- En-tête (`etatPont`, l. 1510) :
  - « En direct » n'apparaît que si le pont a répondu il y a moins de 10 min ;
  - sinon : « Pont injoignable, dernière synchro HH:MM:SS » (ou « Jeton du pont requis »), et le
    témoin devient gris (`.pulse.eteint`, l. 650) ;
  - en maquette : « Maquette locale, HH:MM:SS ».
  Le texte HTML initial n'affirme plus « En direct » avant le premier rafraîchissement
  (l. 670, 678).
- **Vérifié.**
  - Scénario A : en-tête « Pont injoignable » avec témoin gris, toutes les mesures à « — »,
    lots b1-b3 « Sans mesure » en `bad`, 3 alertes, `online` 0/9.
  - Scénario F : coupure suivie de 11 min sans rien → `currentTemp` = `null`, « Sans mesure »,
    pas de point live.

### P2 : « Dernière remontée »
- La source de la donnée est corrigée : `d.seen` est posé dans `pontApplique` (voir P1).
- `ago()` renvoie « jamais » si `t` est absent (l. 726).
- **Vérifié (scénario B)** : « il y a 5 s » pour les appareils qui répondent, « jamais » pour la
  sonde indisponible. Plus de « NaN ».

### P3 : la mémoire ne s'éteint plus avec le pont
- `sparkPath`, `tempCfg` et `humCfg` lisent la mémoire dès que `histDe(b).length > 1` (`aMemoire`,
  l. 898), quel que soit l'état du pont. `sondeReelle` (qui exige `PONT.actif`) ne sert plus qu'à
  `enregistrerTemperatures`.
- L'enregistrement n'avance pas sans valeur fraîche : `currentTemp` renvoie `null`, et l'humidité
  exige elle aussi `fraiche`.
- La vignette ne trace que les mesures des dernières 24 h. Le repli `h.slice(-2)`, qui présentait
  deux mesures anciennes comme récentes, est supprimé.
- **Vérifié (scénario F)** : pendant la coupure, la courbe garde ses 121 points mémorisés, la
  vignette est tracée, et la mémoire n'avance pas.

### P4 : un lot qui ne remonte plus est signalé
- `status()` (l. 1075) renvoie `['bad', 'Sonde hors ligne']` si toutes ses sondes sont hors
  ligne, et `['bad', 'Sans mesure']` si une sonde est reliée mais sans valeur fraîche. Le lot est
  compté dans l'indicateur, renommé « Alertes de température » (l. 1794).
- « Sans sonde » et « Aucune sonde reliée » sont réservés au lot qui n'a aucune sonde
  (`sansMesure`, l. 1012).
- J'ai aussi traité le P4 de la revue elle-même (puissance des prises) :
  - au chargement, hors maquette, `delete d.power` pour toutes les prises (l. 1558) ;
  - `tick` n'écrit plus de watts qu'en maquette (l. 1072) ;
  - une prise Meross affiche « ON » ou « OFF », et l'indicateur de puissance affiche
    « non mesurée » (l. 1489, 1796, 2041).
- **Vérifié.** Scénario B : b2 (sonde indisponible) en « Sonde hors ligne », `bad`, compté.
  Scénario D (maquette) : les watts simulés sont conservés (« 578 W »).

### P5 : point d'amorce
- Le test d'écart est ajouté : `s0 − a ≤ 2 × pasDe(a)`, avec le pas fin ou large selon le point
  (l. 1262-1267).
- Le point est **interpolé à `from`** sur le segment qui relie les deux mesures : il ne sort plus
  du cadre. Il n'est ajouté que si la première mesure est postérieure à `from`, donc jamais deux
  fois le même point.
- Le `clipPath` (item 5) protège aussi l'aire.
- `ajouterLive` (l. 1290) ne relie plus non plus le point live à une mémoire dont il est séparé
  par un trou.
- **Vérifié (scénario C).**
  - Fenêtre de 24 h ne contenant qu'un point, précédent vieux de 28 h : aucune amorce, segment à
    1 point.
  - Précédent à 2 min : amorce placée exactement à `x0`, valeur interpolée 22,5.

### P6 : libellé de surveillance
- `surveillance(d)` (l. 2073) remplace `surveillanceTexte`. Elle reprend une à une les conditions
  que `tick` exige pour réguler :
  - maquette ;
  - lien `demo` ;
  - lot en cours ;
  - entité ;
  - `PONT.actif` ;
  - onglet maître, lu **sans effet de bord** par `regulParCetOnglet` (l. 2066), car `regulMaitre`
    écrit dans le stockage ;
  - `regulPause` ;
  - `regulRefus` ;
  - mesure fraîche.
  Elle ne dit « régulée par la page » que si toutes ces conditions sont réunies.
- La coupure à 90 min n'est annoncée que si la prise a été allumée par une commande automatique.
  Une prise en auto allumée autrement est signalée « le serveur ne la coupera pas ».
- « allumée à la main, personne ne la surveille » est désormais **en orange**, sur la multiprise
  comme dans « Appareils reliés » (`.sv-warn`, l. 648 et 1877).
- **Vérifié.**
  - Scénario E : « régulée par la page, coupée par le serveur au plus tard 90 min… » après la
    commande ; avec une sonde périmée, « non régulée : aucune mesure de température récente »
    en orange.
  - Scénario B : « changée hors du dashboard » en orange.
  - Scénario D : « régulée par la simulation (maquette locale) ».

### P7 : « Activité récente » et autres fuites du modèle
- Le fil passe par le même filtre que le journal du lot (`evVisible`, l. 1458 ;
  `activiteRecente`).
- **Décision à signaler.** J'ai appliqué strictement la règle absolue n° 5 du brief : « seul
  `PONT_LOCAL` » laisse parler le modèle. J'ai donc retiré le critère `estDemo` des chemins
  d'affichage (vignette, courbes, journal, fil ; commentaire l. 882). Avant, sur un navigateur
  neuf servi par le cluster, le garum (b4, relié seulement à la prise de démonstration o3)
  passait pour un « lot de démonstration ». Il affichait alors une courbe du modèle à 60 °C et,
  au nom du vrai relais Outlet 3, des « activation de la chauffe à 59,8 °C ». C'est exactement
  le symptôme cité par la revue, et mon premier passage du scénario A le montrait encore. La
  marque `demo` des prises est **inchangée** : la régulation la lit toujours, prise par prise et
  dans le même sens.
- Autres fuites du tableau P7 de la revue, traitées aussi :
  - Une sonde ajoutée à la main (sans entité) n'est plus simulée hors maquette (`tick`,
    l. 1029). Elle ne peut donc plus écrire le modèle dans la mémoire réelle.
  - `heatSeeded` ne modifie plus `d.on` d'une vraie prise hors maquette (l. 1446).
  - `heater(b)` devient `chauffe(b)` (l. 1099) : il lit les prises non `demo` en premier, toutes,
    et seulement à l'état frais.
  - Le libellé « Mémoire des mesures en cours de constitution » peut de nouveau s'afficher.
  - `humCfg` découpe les trous comme la température.
- `PONT_LOCAL` est remontée en tête du script (l. 713), parce que `heatSeeded` la lit au
  chargement. Plus bas, elle aurait levé une erreur de zone morte temporelle.
- **Vérifié.** Scénario A : 23 événements `sim` stockés, **0 affiché**. Scénario D (maquette) :
  23 affichés, comme avant.

---

## Ce que je n'ai pas fait, et pourquoi

- **`design/correctifs-diff.txt`** n'est pas régénéré : la consigne interdit de toucher à un autre
  fichier. Le diff contre `design/dashboard-apres-correctifs-1.html` le remplace.
- **Clé de stockage séparée pour `S.hist`** : je ne l'ai pas faite, ce n'est pas dans les points 1
  à 6. La taille de la mémoire est inchangée (4 320 points par lot).
- **L'archive d'un lot terminé reste tracée par le modèle** (`archStats`), comme le brief
  l'assume. La carte « Mesures relevées » le dit en clair.
- **La maquette `file://` n'est plus présentée comme « En direct »** mais comme « Maquette
  locale ». Ses valeurs simulées, ses watts, sa régulation locale et ses événements simulés sont
  inchangés (scénario D).

## Où un test peut se tromper

- **Valeur figée sans pont.** Un test qui attend l'ancienne valeur (21,3 °C, 60,0 °C) affichée
  sans pont échouera, et c'est voulu. Pour obtenir une valeur affichée, le faux pont doit avoir
  répondu il y a moins de 10 min **dans le même onglet**, puisque `d.recu` est horodaté par la
  page. Avec une horloge pilotée qui avance de plus de 10 min sans réponse du pont, tout passe
  à « — » et l'en-tête dit « Pont injoignable ».
- **Le statut d'un lot change avec la fraîcheur, puis les alertes.** Une sonde périmée fait passer
  le lot en `bad` et l'ajoute aux alertes. Un compte d'alertes figé sur l'ancien comportement
  sera faux.
- **La régulation dépend aussi de la fraîcheur.** Elle ne décide plus rien sur une température
  vieille de plus de 10 min, puisque `currentTemp` renvoie `null`. Cela ne peut arriver que si le
  pont répond sans valeur numérique pour la sonde : quand le pont répond, les valeurs sont
  fraîches. Les freins eux-mêmes n'ont pas changé.
- **Lots de démonstration.** Un test qui attend une courbe du modèle pour un lot « de
  démonstration », page servie en HTTP, échouera. C'est voulu (règle n° 5, voir P7).
- **Bouton « Mis de côté ».** Il n'existe que si `S.eventsArchive` n'est pas vide. Sur un
  navigateur neuf, la migration ne trouve rien et le bouton n'apparaît pas.
- **Rendu au premier passage du pont.** La première synchro réussie provoque un `render()`
  complet, parce que les valeurs deviennent fraîches. Un formulaire en cours de saisie à ce
  moment précis serait redessiné. Le comportement existait déjà pour un passage en ligne.
