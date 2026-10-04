# Seconde relecture — correctifs du dashboard de fermentation (suite de `revue-correctifs.md`)

Tu as relu une première version de ces correctifs et écrit `design/revue-correctifs.md`, avec un
verdict « à corriger avant publication » et trois points bloquants. Cette version-ci les traite.

## Ce qui a changé depuis ta relecture

1. **`enregistrerTemperatures`** : l'horodatage est désormais ancré sur la tranche de 3 minutes
   (`trancheHist`) et la valeur est réécrite tant qu'on reste dans la même tranche. Une synchro
   toutes les 15 s fait donc bien grandir la mémoire, une mesure par tranche.
2. **`estDemo`** : vrai seulement si **tous** les appareils reliés au lot portent `demo`. Un vrai
   lot ne redevient plus une démonstration parce qu'une prise de la maquette y est restée reliée.
3. **`sondeReelle(b)`** : la courbe suit la source réelle de la mesure — pont actif et sonde
   reliée avec `eid`, non marquée `demo`. Le modèle ne parle plus que pour un lot de démonstration
   ou pour la page ouverte sans pont (`!PONT.actif`).
4. **La branche de repli de `tick()`** (celle qui basculait une prise sans envoyer d'ordre) marque
   maintenant son événement `sim: true`. C'est elle, et non le générateur de 36 h, qui produisait
   les « Désactivation de la chauffe » du journal.
5. **`regulerPont`** marque ses événements `reel: true`, et la migration les épargne.
6. Le journal filtre **par événement** (`!e.sim || estDemo(b) || !PONT.actif`), plus par lot.
7. Vignette : abscisse calculée sur le nombre de points, point unique dupliqué, plus de modèle en
   bout de courbe pour un lot terminé.
8. `tempCfg` : une série par plage continue (un trou de sonde coupe la courbe au lieu de la relier),
   et plus de doublon quand la fenêtre ne contient qu'un point.
9. `humCfg` suit la même mémoire que la température (humidité réellement mesurée).
10. `save()` : en cas de quota plein, élagage puis nouvelle tentative, et alerte journalisée si
    l'écriture échoue toujours ; `finish` résume la mémoire du lot avant de la libérer ;
    `delete-batch` et le démarrage nettoient les historiques orphelins.

## Ce que je te demande

- Vérifier que chacun de tes points est réellement traité, et pas seulement déplacé.
- Chercher ce que **cette** version casse ou introduit de nouveau : `save()` qui élagu(e) la
  mémoire, `estDemo` qui change de sens (quels lots deviennent réels, lesquels cessent de l'être,
  et est-ce cohérent avec la marque `demo` qui protège contre un second navigateur), le calcul des
  tranches autour des changements d'heure, la duplication du point unique, la migration.
- Dire si le résultat est publiable en l'état.

## Points que je sais non traités

- Aucun moyen de consulter ni de restaurer `S.eventsArchive` depuis l'interface.
- La rétention reste de 9 jours (4320 points) : « Tout » ne remonte pas au début d'une bière de
  21 jours.
- Le résumé `b.mesures` est écrit à la fin d'un lot mais l'archive ne l'affiche pas encore.
- L'axe vertical garde la ligne de consigne dans son échelle : pour un lot dont la mesure est loin
  de la cible, la courbe paraît plate. Choix assumé, à discuter.
- Pas de sous-échantillonnage à deux niveaux (3 min puis 30 min).

## Livrable

`design/revue-correctifs-2.md` : pour chaque point, vérifié ou non, ce qui reste risqué, et un
verdict. Le diff complet par rapport au fichier d'origine est dans `design/correctifs-diff.txt`.
**N'écris que ce rapport** : tu lis le dashboard, tu ne le modifies pas.
