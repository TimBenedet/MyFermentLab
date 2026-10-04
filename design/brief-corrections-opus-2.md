# Cahier des charges — corrections Opus n° 2

## Contexte

`design/revue-correctifs-4.md` (relecture de la passe `corrections-opus-1`) valide l'essentiel et
signale des défauts courts. `design/corrections-opus-1.md` est ton propre rapport de la passe
précédente. La sauvegarde de référence pour diffé ton travail est
`design/dashboard-apres-correctifs-1.html` ; l'état actuel en est à +602/−80 lignes.

## Règles absolues — inchangées

1. Un seul fichier, **aucune dépendance**, pas de compilation. Il doit continuer à fonctionner
   ouvert en `file://` (mode maquette, valeurs simulées).
2. **Ne touche à aucun frein de régulation** : `AUTO_COOLDOWN`, `AUTO_MAX_ON`, `AUTO_PAUSE`,
   `AUTO_REFUS`, `regulerPont`, `regulerSecurite`, `regulMaitre`, ni à la boucle de décision de
   `tick`. Une question de sécurité est en attente de décision du propriétaire : **ne l'anticipe
   pas**, elle fera l'objet d'une passe séparée.
3. **Ne retire aucune marque `demo`** (elle empêche un second navigateur de commander les prises).
4. Aucune commande ne doit pouvoir partir d'autre chose que d'un clic de l'utilisateur ou de
   `regulerPont`.
5. **Ne touche pas au pont** (`pont.py`, `api/etat`, `api/prise`) : ses évolutions sont un chantier
   à part.
6. Fins de ligne CRLF, fichier actuellement propre (2 474 CRLF, zéro LF isolé).
7. Tu peux lancer tes propres essais (Bash autorisé) mais tu **n'écris rien dans le dépôt hors ton
   rapport** : garde tes scripts dans `C:/tmp/hakko-verif-5/`.

## Corrections demandées

1. **Fil « Activité récente » : marquer les événements restaurés.** `journalHTML` affiche bien
   « (restauré, provenance non vérifiée) », mais le fil n'affiche que `e.x` : un événement fabriqué
   restauré y repasse pour une vraie commande, alors que la boîte de dialogue promet l'inverse.
2. **« Tout restaurer » est irréversible et ne demande aucune confirmation.** Ajoute une
   confirmation explicite. Si tu peux offrir un retour en arrière simple sans alourdir, dis-le,
   sinon contente-toi de la confirmation.
3. **Trous de sonde au niveau horaire.** `decouper` tolère deux pas, soit 2 h une fois les mesures
   regroupées par heure : une heure entièrement manquante relie donc la courbe. Coupe dès qu'une
   heure pleine manque (`> 1 × pas` quand le point précédent est horaire, en gardant deux pas au
   niveau fin). Vérifie qu'un trou de 2 h 54 et un trou de 1 h 10 coupent bien la courbe, et qu'un
   trou de 1 h 40 à la jonction des 48 h reste visible.
4. **Le repère de cible arrondit le chiffre qu'il oppose à l'écart.** Pour une cible de 18,5 °C il
   affiche « cible 19 °C, 11,5 °C plus bas » : les deux nombres se contredisent. Utilise une
   décimale quand la cible n'est pas entière, dans le repère comme dans le libellé de la ligne.
5. **« Pas encore de mesure » est faux quand la mémoire existe mais date de plus de 24 h** (pont
   coupé depuis 30 h par exemple) : la plage « Tout » les montre. Dis plutôt qu'il n'y a aucune
   mesure sur les dernières 24 h, en donnant la date de la dernière.
6. **Quand la cible est hors du cadre**, le repère devrait rappeler l'heure de la dernière mesure
   utilisée pour calculer l'écart, puisque celle-ci peut dater de plusieurs heures.
7. **Quand la consigne est hors du cadre**, la légende annonce toujours « Consigne » et « Plage
   tolérée » alors que rien n'est tracé : ne les annonce que si elles le sont.
8. **Après la fermeture de la boîte des événements restaurés, le focus tombe sur `body`** (le bouton
   d'origine a été détruit par `render()`, et il disparaît même quand l'archive se vide). Rends le
   focus à un élément stable et utile (par exemple le titre de la page ou le lien de navigation de
   la section). Vérifie aussi `indeterminate` sur « Tout sélectionner » quand la sélection est
   partielle.
9. **La moyenne horaire est tracée au début de l'heure**, ce qui décale la courbe d'une demi-heure.
   Corrige si c'est propre (la mémoire doit rester ancrée sur l'heure et strictement croissante) ;
   sinon, explique pourquoi tu laisses.
10. **Fusion « horloge reculée »** : l'humidité suppose que tous les relevés du point précédent en
    avaient une. Le poids est légèrement faux si une partie seulement en avait. Corrige la moyenne
    pondérée.

## Livrable

- Le dashboard corrigé, dans `scada-opus-5.5/hakko-dashboard.html`.
- `design/corrections-opus-2.md` en français : pour chaque point, ce que tu as fait, où, ce que tu
  as vérifié toi-même, et ce que tu n'as pas fait avec la raison.
- Rien d'autre.

## Vérification

L'assistant reprendra derrière toi : syntaxe, exécution en HTTP contre un faux pont avec horloge
pilotée, mesure des contrastes **y compris les textes SVG**, et diff contre la sauvegarde. Il ne se
fiera pas à ton rapport.
