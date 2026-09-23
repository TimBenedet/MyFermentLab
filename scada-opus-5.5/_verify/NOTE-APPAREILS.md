# Note — passage de la page « Appareils » aux vrais appareils Home Assistant

Date : 23 septembre 2026. Demande : « modifie les éléments présents dans la partie appareil
avec les vrais présents sur homeassistant […]. Pas de changement de design, juste d'information. »

## Ce qui a été relevé dans Home Assistant

Interrogation de l'API de l'instance (192.168.1.51:8123, `/api/states`) : **83 entités** —
37 `sensor`, 8 `switch`, 5 `binary_sensor`, 5 `number`, 4 `button`, 4 `select`, 10 `update`.

Les 9 appareils retenus sont exactement ceux des trois captures de l'ancien dashboard :

| Nouveau nom affiché | Identifiant d'entité | Ancien (données de démo) |
|---|---|---|
| Sonde-Sonoff-1 Température | `sensor.sonde_sonoff_1_temperature` | Sonde fermenteur Saison |
| Sonde-Sonoff-2 Température | `sensor.sonde_sonoff_2_temperature` | Sonde cellier miso |
| Sonde-Sonoff-3 Température | `sensor.sonde_sonoff_3_temperature` | Sonde chambre koji |
| sonde-sonoff-humidité-1 | `sensor.humidity_1` | Hygromètre chambre koji |
| Multiprise Tim Outlet 1 → 5 | `switch.smart_switch_25021462413795540601c4e7ae132658_outlet_1` → `_5` | Ceinture chauffante, Tapis chauffant koji, Prise étuve garum, + 2 prises générées par la démo |

Relevé au moment du changement : 21,3 / 21,4 / 26,9 °C, 56,9 % d'humidité. Batteries :
100 % / 78 % / 100 % / 100 %. Les 9 appareils sont joignables.

Aucun autre fichier de données n'est touché : les lots, les recettes, les graphiques et tout
le design restent ceux de la référence. L'identifiant d'entité est porté par un nouveau champ
`eid` et affiché en **infobulle** de la cellule « Appareil ».

**Pourquoi pas sous le nom, comme dans l'ancien dashboard ?** Mesuré à 1440 px : afficher
`sensor.sonde_sonoff_1_temperature` sous le nom élargit la colonne « Appareil » de 200 à 278 px
et comprime « Fermentation » de 175 à 117 px. La consigne « pas de changement de design »
l'interdisait ; l'infobulle donne l'information sans coût de mise en page.

| Largeur et version | Appareil | Type | Mesure | Fermentation | Batterie | Dern. remontée | État | Contrôle |
|---|---|---|---|---|---|---|---|---|
| 1440 px — référence (noms de démo) | 200 | 110 | 82 | 175 | 115 | 140 | 117 | 199 |
| 1440 px — livrable (noms réels) | 212 | 110 | 81 | 169 | 122 | 140 | 106 | 199 |
| 1280 px — référence | 145 | 110 | 74 | 109 | 104 | 140 | 117 | 199 |
| 1280 px — livrable | 152 | 110 | 74 | 109 | 112 | 140 | 106 | 199 |

Écart maximal 12 px sur une colonne, dû aux noms réels plus longs que ceux de la maquette.
Le passage des noms sur deux lignes **n'est pas** un effet de ce changement : la référence le
fait déjà à 1440 px comme à 1280 px. Le seul effet visible est que le sélecteur « Fermentation »
dispose de 135 px au lieu de 141 à 1440 px, ce qui coupe la fin de « Saison du Nord #3 » — nom
complet lisible dans la liste déroulante et sur la page du lot.

## Mesures de non-régression

| Contrôle | Avant | Après |
|---|---|---|
| Harnais `verifie.mjs` (182 assertions) | 180 OK / 2 échecs | **180 OK / 2 échecs** |
| Nature des échecs | §9 : débordement de 18,4 px du graphique `#arch-2` à 1280×720 — défaut « Densité » antérieur, connu | identiques, mêmes valeurs |
| KPI « Chauffe active » | 0 prise / 0 W | 0 prise / 0 W |
| KPI « Écarts de température » | 1 | 1 |
| KPI « Appareils en ligne » | 10/11 (11 = 9 appareils de démo + 2 prises générées à l'exécution, dont « Sonde cave » hors ligne) | 9/9 (les 9 appareils réels sont joignables) |
| Erreurs JavaScript | 0 | 0 |

## Deux limites à connaître

1. **Les valeurs affichées restent simulées.** Le dashboard est un fichier statique
   autonome : il n'interroge pas Home Assistant. Chaque sonde affiche la température du lot de
   démonstration auquel elle est reliée — c'était déjà le comportement de la référence. Les
   mesures réelles relevées ci-dessus servent de valeurs initiales. Un affichage réel
   demanderait un appel à l'API de Home Assistant depuis le navigateur, donc l'exposition d'un
   jeton côté client.
2. **L'état des prises est simulé par la démo.** Trois prises restent reliées à des lots :
   c'est nécessaire pour satisfaire le §10.4 du cahier des charges (changer la consigne d'un
   lot doit journaliser une entrée de chauffe) et pour que l'historique de chauffe alimente le
   journal. La simulation les allume selon la consigne — dans Home Assistant elles sont toutes
   éteintes. Les délier toutes supprimerait cette journalisation et ferait échouer 8 assertions
   du harnais. Chaque prise peut être basculée en « Manuel » ou déliée depuis l'interface.
