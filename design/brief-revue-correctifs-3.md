# Troisième relecture — correctifs du dashboard de fermentation

Suite de `design/revue-correctifs-2.md`. Les six défauts que tu y signalais sont traités, plus un
septième que la vérification par capture d'écran a fait apparaître.

## Ce qui a changé depuis ton second rapport

- **N1 — `!PONT.actif` n'est plus le critère de la maquette.** Les quatre endroits que tu citais
  (`sparkPath`, `tempCfg`, `humCfg`, `journalHTML`) testent désormais `PONT_LOCAL`, c'est-à-dire la
  page ouverte en `file://`. Un pont muet — jeton absent sur ce navigateur, coupure, premier
  chargement — ne fait donc plus revenir le modèle : la courbe reste vide.
- **N2 — la branche de repli de `tick()` ne bascule plus une prise réelle.** Elle n'agit plus que
  dans la maquette locale (`else if (PONT_LOCAL)`). Hors maquette, une prise reliée à Home Assistant
  n'est ni commandée ni simulée par cette branche : plus d'inondation d'événements.
- **N3 — `save()`** libère la **plus grosse** mémoire de mesures (et non la plus courte), annonce la
  suppression de l'archive au lieu de la taire, et n'écrit plus qu'une alerte toutes les dix minutes.
- **N4 — `sondeReelle`** ne dépend plus de `d.online` : une sonde qui décroche laisse un trou, elle ne
  transforme pas le lot en démonstration.
- **N5 — le point d'amorce** rejoint le premier segment au lieu de former une série isolée.
- **N6 — la vignette** ne trace plus rien quand il n'y a qu'un point, au lieu d'un palier sur toute
  la largeur.
- **N7 — le libellé de coupure** dit maintenant « coupée par le serveur 90 min après une commande
  automatique », ce qui est la vérité : le garde-fou du pont ne s'arme que sur une commande `auto`.
- **Nouveau, trouvé par capture d'écran** : dans un navigateur sans jeton, la carte de température
  affichait **60,0 °C** — la valeur du modèle — parce que `tick()` simulait la valeur des sondes dès
  que `PONT.actif` était faux. Une entité reliée à Home Assistant n'est désormais jamais inventée
  hors maquette : la dernière valeur réellement reçue est conservée telle quelle. Même correction
  pour la puissance affichée des prises.
- **R9** : un recul de l'horloge système n'écrit plus un point plus ancien que le précédent.

## Ce que je te demande

- Vérifier chacune de ces corrections sur le fichier, et **chercher ce qu'elles cassent**. En
  particulier : `PONT_LOCAL` remplace `!PONT.actif` partout où le modèle parlait — reste-t-il un
  endroit où un lot réel affiche encore autre chose que ce que ses sondes ont dit ? Et la maquette
  ouverte en local a-t-elle toujours son comportement d'origine ?
- Le cas « pont actif mais aucune donnée pour un appareil » : que voit l'utilisateur, et est-ce
  honnête ?
- Redire, une dernière fois, si le résultat est publiable.

## Toujours non traités, et je l'assume

- Aucun moyen de consulter ou restaurer `S.eventsArchive` depuis l'interface.
- Rétention de 9 jours ; pas de sous-échantillonnage à deux niveaux.
- Le résumé `b.mesures` n'est pas affiché dans l'archive.
- L'axe vertical inclut la ligne de consigne.
- Le survol d'un graphique à plusieurs segments ne lit que la première série (les segments servent à
  ne pas relier deux mesures séparées par un trou de sonde).

## Livrable

`design/revue-correctifs-3.md`, en français, avec un verdict clair. Le diff complet par rapport au
fichier d'origine est dans `design/correctifs-diff.txt`. **N'écris que ce rapport** : tu lis le
dashboard, tu ne le modifies pas.
