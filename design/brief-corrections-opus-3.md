# Cahier des charges — corrections Opus n° 3

## Contexte

`design/revue-correctifs-4.md` est la relecture de ta passe précédente ; les points 1 à 10 qu'elle
demandait sont faits et vérifiés (dont le repère « écart à la dernière mesure, à HH:MM », la cible
décimale, la confirmation de « Tout restaurer », le poids d'humidité `nh`). Il reste ce que ta
propre passe n° 2 a listé comme non fait, plus un défaut signalé par la relecture et plus grave.

## Règles absolues — inchangées

1. Un seul fichier, **aucune dépendance**, pas de compilation, la page doit continuer à fonctionner
   ouverte en local en `file://`.
2. **Ne touche à aucun frein de régulation** : `AUTO_COOLDOWN`, `AUTO_MAX_ON`, `AUTO_PAUSE`,
   `AUTO_REFUS`, `regulerPont`, `regulerSecurite`, `regulMaitre`, ni à la boucle de décision de
   `tick`. La question « faut-il couper plus tôt quand la sonde se tait » est **en attente de la
   décision du propriétaire** : ne l'anticipe pas.
3. **Ne retire aucune marque `demo`.** Hors maquette, aucun appareil ne doit être simulé.
4. **Ne touche pas au pont** (`pont.py`, `api/etat`, `api/prise`).
5. Fins de ligne CRLF. Tu laisses tes scripts de test dans `C:/tmp/hakko-verif-6/`.
6. La charte graphique ne change pas. Si tu touches à une couleur, dis-le explicitement.

## Corrections demandées

1. **« Terminer le lot » pendant une chauffe ne coupe rien sur la prise réelle.** C'est le défaut
   le plus grave de la liste : la page éteint la prise dans son état local et affiche « éteinte »
   alors que le relais reste fermé. Une résistance qui continue de chauffer un seau après la
   clôture du lot est exactement le mensonge que ce travail cherche à éliminer. Fais en sorte que
   la clôture d'un lot **envoie réellement l'ordre d'arrêt** à chaque prise réelle allumée qui lui
   était rattachée, avec une confirmation explicite de l'utilisateur qui dit ce qui va être coupé.
   C'est une commande d'arrêt uniquement (jamais d'allumage), elle ne dépend d'aucun frein de
   régulation, et elle ne doit toucher que les prises rattachées à ce lot.
2. **Sonde sans entité : « Sans nouvelles » pour toujours.** Un appareil ajouté à la main n'a
   aucune source de mesure : « Sans nouvelles » suggère une perte temporaire et laisse espérer un
   retour. Dis la vérité : cet appareil n'a pas d'entité, il ne remontera jamais de mesure.
3. **La vignette de la vue d'ensemble ne découpe pas les trous** de sonde, alors que la grande
   courbe le fait depuis peu. Applique-lui la même découpe.
4. **Plafond des événements restaurés.** La relecture n° 4 redoutait qu'un événement restauré,
   étant ancien, soit chassé par le plafond. Tu as exclu les restaurés de `bornerEvents` ; dis
   maintenant ce qui reste réellement à risque (plafond de l'archive elle-même, restauration en
   masse, chaîne d'événements) et corrige-le si c'est le cas. Sinon, écris pourquoi c'est couvert.
5. **Contrastes.** Ces textes restent sous le seuil AA et sont antérieurs à tout ce travail :
   `.feed .fm` (2,54), `.nav-sec` (3,91), le bouton « ON » des prises (3,49), et les autres que tu
   as mesurés. Remonte-les au-dessus de 4,5 **en gardant les teintes de la charte** (assombrir un
   texte secondaire plutôt que changer une couleur d'identité). Si l'un d'eux ne peut pas passer
   sans abîmer la charte, dis lequel et pourquoi, et laisse-le.

## Livrable

- Le dashboard corrigé, `scada-opus-5.5/hakko-dashboard.html`.
- `design/corrections-opus-3.md` en français : par point, ce que tu as fait, où, ce que tu as
  vérifié toi-même, et ce que tu n'as pas fait avec la raison.
- Rien d'autre.

## Vérification

L'assistant reprendra derrière toi : freins de régulation comparés au caractère près, syntaxe,
exécution en HTTP contre un faux pont avec horloge pilotée, contrastes SVG compris, et un scénario
spécifique de clôture de lot avec une prise allumée. Il ne se fiera pas à ton rapport.
