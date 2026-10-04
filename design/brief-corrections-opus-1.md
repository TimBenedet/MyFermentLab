# Cahier des charges — corrections à faire par Opus dans `scada-opus-5.5/hakko-dashboard.html`

## Contexte

Page unique, sans dépendance ni compilation : un seul fichier HTML de 2 200 lignes qui sert de
dashboard de fermentation (lots, courbes, journal, prises connectées). Elle est servie par un
cluster k3s via un trajet GitOps, et **pilotée par Home Assistant** : elle peut commander de vraies
résistances chauffantes par l'intermédiaire d'un pont sidecar.

Deux relectures successives ont établi l'état actuel. Une sauvegarde du fichier avant tes
modifications est dans `design/dashboard-apres-correctifs-1.html` : ton travail sera diffé contre
elle, et pourra être annulé si besoin.

## Règles absolues — à ne pas franchir

1. **Aucune dépendance nouvelle**, aucune compilation, un seul fichier. Pas de framework, pas de CDN.
2. **Ne touche pas aux freins de régulation** : `AUTO_COOLDOWN`, `AUTO_MAX_ON`, `AUTO_PAUSE`,
   `AUTO_REFUS`, ni à la fonction `regulerPont`, ni au contrat du pont (`api/prise` en `auto: true`
   uniquement depuis `regulerPont`).
3. **Ne retire aucune marque `demo`** : elle empêche qu'un second navigateur (un téléphone) commande
   les vraies prises en même temps que l'ordinateur qui régule. La régulation la vérifie prise par
   prise, et cette vérification ne doit pas changer de sens.
4. **Aucun envoi de commande** vers une prise ne doit découler d'autre chose qu'un clic de
   l'utilisateur ou d'une décision de `regulerPont`. Une modification d'affichage ne commande rien.
5. **La page doit continuer à fonctionner ouverte en local** (`file://`), sans pont : c'est le mode
   maquette, avec ses valeurs simulées. C'est le seul cas où le modèle de simulation a le droit de
   parler à la place d'une sonde (`PONT_LOCAL`).
6. Le fichier est en fin de ligne CRLF ; conserve-les.

## Corrections demandées

1. **Consulter et restaurer les événements mis de côté** (`S.eventsArchive`). Une migration a rangé
   là les événements de chauffe dont la provenance n'était pas vérifiable. Aujourd'hui l'archive
   n'est visible nulle part : « conservée » ne veut dire que « encore dans le stockage du
   navigateur ». Ajoute un moyen sobre de voir combien d'événements sont rangés, de les consulter,
   et d'en restaurer tout ou partie. Pense à empêcher la migration de les reprendre ensuite.
2. **Rétention et échantillonnage de la mémoire des mesures** (`S.hist`). Aujourd'hui : un point
   toutes les 3 minutes, 4320 points, environ 9 jours. Une bière dure 21 jours, un miso une année.
   Propose et applique un échantillonnage à deux niveaux (fin sur les dernières 48 h, plus large
   au-delà) pour couvrir plusieurs mois à taille comparable, en gardant l'ancrage sur la tranche et
   le tri strictement croissant.
3. **Afficher le résumé de fin de lot** (`b.mesures`, écrit par `finish` : nombre de points, moyenne,
   min, max) dans la vue Archive, à côté des courbes agrégées.
4. **L'axe vertical de la courbe de température.** Aujourd'hui il inclut la ligne de consigne : pour
   un lot dont l'eau est à 23 °C et la cible à 60, la courbe paraît plate. Trouve un affichage
   honnête qui rende la mesure lisible sans mentir sur la distance à la cible. C'est un arbitrage de
   design : explique ton choix.
5. **Le survol d'un graphique découpé.** La courbe d'un lot réel est découpée en plusieurs segments
   quand un trou de sonde sépare deux mesures (pour ne pas tracer un trait droit qui ressemblerait à
   une mesure). Le survol ne lit aujourd'hui que le premier segment. Corrige `drawChart` pour qu'il
   lise le segment réellement survolé.
6. **Ce que `design/revue-correctifs-3.md` signale.** Lis ce rapport : ses points P1 à P7 sont fondés,
   l'assistant les a vérifiés. Traite-les tous.
   - **P1 (bloquant) — une valeur figée ne doit pas passer pour une mesure en direct.** La correction
     précédente a cessé d'inventer des valeurs, mais celles déjà écrites (ou celles du jeu de
     démonstration) restent affichées indéfiniment, sous un bandeau « En direct ». Pose `d.recu`
     (et `d.seen`) dans `pontApplique` pour chaque appareil présent dans la réponse, et hors maquette
     traite comme absente toute valeur dont la réception date de plus de dix minutes :
     `currentTemp` et `currentHum` renvoient `null`, la carte affiche « — », le lot annonce
     « Sans mesure » au lieu d'un statut calculé sur une valeur périmée, et le point « live » ne se
     trace pas. Le bandeau d'en-tête doit cesser de dire « En direct » quand plus rien ne rentre.
   - **P2 (bloquant) — régression à corriger.** La colonne « Dernière remontée » n'est plus jamais
     mise à jour, parce que seul `tick` posait `d.seen` et qu'il ne le fait plus pour une entité
     réelle. Un navigateur neuf affiche « il y a NaN j ». Corrige la source de la donnée, pas
     l'affichage.
   - **P3 — la mémoire ne doit pas s'éteindre avec le pont.** `sondeReelle` exige encore `PONT.actif` :
     pendant une coupure, la courbe réelle disparaît. Une mesure enregistrée reste vraie. En revanche
     l'enregistrement, lui, ne doit pas avancer sans valeur fraîche.
   - **P4 — un lot qui ne remonte plus doit être signalé.** Aujourd'hui il est marqué « Sans sonde » et
     sort des alertes, alors que c'est précisément le moment où la régulation s'arrête.
   - **P5 — le point d'amorce** d'une courbe découpée ne doit ni relier les deux bords d'un trou ni
     sortir du cadre : ajoute le test d'écart qui manque.
   - **P6 — le libellé de surveillance** annonce « régulée par la page » dans des cas où la page ne
     régule pas.
   - **P7 — le fil « Activité récente »** de la vue d'ensemble n'est pas filtré comme le journal du
     lot : les événements simulés y apparaissent encore pour un lot réel.

## Ce que tu livres

- Le dashboard modifié, dans `scada-opus-5.5/hakko-dashboard.html`.
- Un rapport `design/corrections-opus-1.md`, en français : pour chaque correction, ce que tu as fait,
  où (numéros de ligne), et ce que tu as vérifié toi-même. Dis explicitement ce que tu n'as pas fait
  et pourquoi.
- N'y touche à aucun autre fichier que ces deux-là.

## Ce sur quoi tu seras vérifié

L'assistant reprendra le fichier derrière toi : contrôle de syntaxe, exécution dans un vrai
navigateur (page servie en HTTP, faux pont, horloge pilotée), mesure des contrastes et du parcours
clavier, et comparaison avec la sauvegarde. Il ne se fiera pas à ton rapport : ce sont les tests qui
tranchent. Écris donc du code qui passe ces contrôles, et signale les endroits où tu penses qu'un
test peut se tromper.
