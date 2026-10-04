# Relecture demandée — correctifs du dashboard de fermentation

## Contexte

Le propriétaire a branché une ceinture chauffante (4 L d'eau, sonde dans l'eau) sur la prise 4 de
sa multiprise, et a constaté deux choses fausses à l'écran :

1. Le graphique de température traçait une ligne plate à 60,1 °C, soit exactement sa **consigne**
   (60,0 °C, tolérance ±0,5), alors qu'aucune sonde de la maison ne dépassait 27 °C. La carte du
   haut, elle, affichait la bonne valeur (22,5 °C, conforme à la sonde 1 à 22,6 °C).
2. Le journal du lot annonçait « Désactivation de la chauffe » alors que la prise était allumée,
   et le pont n'avait reçu aucune commande à cet instant.

Diagnostic établi par lecture du code et par lecture de l'état réel dans Home Assistant :
le graphique et le journal étaient alimentés par le **modèle de simulation** (`model`), et un
générateur d'historique de démonstration écrivait 36 heures de cycles de chauffe **pour tout lot
ayant une prise reliée**, y compris les lots réels, avec les températures du modèle.

Vérifications côté serveur, à titre de preuve : aucune sonde au-dessus de 27 °C ; sur la dernière
heure, le pont n'avait envoyé que quatre commandes, toutes « off » (prises 1, 2, 3, 5), jamais la
prise 4 ; la prise 4 était allumée depuis un changement venu d'ailleurs que du dashboard.

## Ce qui a été modifié dans `scada-opus-5.5/hakko-dashboard.html`

Trois correctifs, plus une migration. Le diff complet est dans `design/correctifs-diff.txt`.

1. **Mémoire des mesures réelles** (`estDemo`, `enregistrerTemperatures`, `histDe`, `S.hist`) :
   à chaque synchronisation avec le pont, la température réelle de chaque lot actif est enregistrée
   (une mesure retenue toutes les 3 minutes, plafond 4320 points). `tempCfg` et `sparkPath` tracent
   cette mémoire pour un lot réel, le modèle restant réservé aux lots de démonstration. Un lot réel
   sans mémoire affiche une courbe vide plutôt qu'une simulation.
2. **Fin de la fiction** : le générateur d'historique ne traite plus que les prises marquées
   `demo`. Ses événements portent `sim: true`, et `journalHTML` les cache aux lots réels. Une
   migration unique déplace les événements de chauffe déjà écrits vers `S.eventsArchive` (conservés,
   pas supprimés) et le signale dans le fil d'activité.
3. **Origine et surveillance d'une prise** : `pontApplique` marque `origine: 'externe'` quand
   l'état change sans commande de la page dans les 90 secondes ; `regulerPont` et `pontBascule`
   marquent `regul` ou `clic`. La fonction `surveillanceTexte` et la ligne « Surveillance »
   (onglet Prises et « Appareils reliés ») disent qui surveille la prise, en orange quand personne.

## Ce que la relecture doit chercher

Merci de relire le diff comme du code qui commande des résistances chauffantes. En particulier :

- **Sécurité** : rien dans ces changements ne doit pouvoir allumer une prise, ni contourner les
  freins existants de la régulation (`AUTO_COOLDOWN`, `AUTO_MAX_ON`, `AUTO_PAUSE`, `AUTO_REFUS`),
  ni retirer la marque `demo`, ni changer le contrat du pont (`api/prise` avec `auto: true`
  uniquement depuis `regulerPont`).
- **Croissance des données** : `S.hist` est écrit dans le même `localStorage` que l'état. Le
  plafond par lot est-il le bon, et faut-il purger les lots terminés ou archivés ?
- **Discriminant du lot réel** : `estDemo(b)` renvoie vrai si un appareil relié porte `demo`.
  Est-ce le bon critère, sachant que la marque est posée sur les prises de la maquette et que
  l'utilisateur peut relier lui-même un lot à une prise (la marque tombe alors) ?
- **Idempotence et données de l'utilisateur** : la migration est-elle rejouable sans perte ? Le
  drapeau `migrationSim` peut-il manquer tout en ayant déjà migré ? Que se passe-t-il pour un lot
  dont la sonde est hors ligne une partie du temps ?
- **Robustesse d'affichage** : `sparkPath` avec un seul point, `tempCfg` sans aucune mesure,
  empreinte mémoire du tableau `pts` quand `detailRange` vaut « Tout » sur un lot long.
- **Faux positifs de la détection d'origine** : une commande de la page suivie d'une relecture
  tardive du pont (la multiprise Meross met 1 à 3 secondes à confirmer, et le pont relit jusqu'à
  4 secondes) peut-elle se faire étiqueter « externe » à tort ? La fenêtre de 90 secondes est-elle
  justifiée ?
- **Cohérence de l'ensemble** : le journal, la courbe et la carte du haut racontent-ils maintenant
  la même chose ? Reste-t-il un endroit de la page où le modèle parle encore à la place d'une sonde
  pour un lot réel (`humCfg`, la sparkline, les KPI d'accueil) ?

## Livrable attendu

Un rapport en français dans `design/revue-correctifs.md` : pour chaque point, ce qui est correct,
ce qui est risqué, et une correction proposée quand il y en a une, avec les numéros de ligne. Un
verdict final : publiable en l'état, ou à corriger avant.

**Ne modifie aucun fichier autre que ce rapport.** Le dashboard lui-même est hors de ta portée
pour cette relecture : tu le lis, tu ne l'écris pas.
