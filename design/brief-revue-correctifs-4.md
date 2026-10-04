# Relecture n° 4 — la passe de corrections d'Opus

## Ce que tu relis

Une autre session d'Opus (toi, avec le droit d'écrire) a appliqué un cahier des charges de six
corrections plus sept points signalés par une relecture précédente, dans
`scada-opus-5.5/hakko-dashboard.html`. Son rapport est `design/corrections-opus-1.md`.

- Le diff **de cette passe** : `design/corrections-opus-1-diff.txt` (690 lignes), contre
  `design/dashboard-apres-correctifs-1.html`.
- Le diff **depuis l'origine** : `design/correctifs-diff.txt` (1 041 lignes).

## Règle de lecture

**Sois sceptique envers le rapport de l'auteur.** Il affirme beaucoup de choses vérifiées ; tu les
reprends une par une sur le code et, si tu peux, en exécutant la page. Tu as le droit d'utiliser
Bash pour tes propres essais, mais **n'écris rien dans le dépôt** : garde tes éventuels scripts de
test dans `C:\tmp\hakko-verif-4\`, et n'écris que ton rapport.

De la même façon, l'assistant (modèle moins puissant) a mesuré ceci ; si tu penses qu'une de ces
mesures est mal faite ou mal interprétée, dis-le, c'est exactement ce qu'on attend de toi :

- `AUTO_*`, `regulerPont`, `regulerSecurite`, `regulMaitre` : identiques au caractère près à
  `design/dashboard-apres-correctifs-1.html` ;
- une seule commande émise dans ses six scénarios, par `regulerPont` avec `auto: true` ;
- une valeur reçue il y a plus de dix minutes affiche « — » et le lot passe en « Sans mesure » ;
- restauration : 1 événement restauré, marqué, archive vidée, et `S.events` compte 501 entrées
  après coup (donc le plafond ne le chasse pas) ;
- mémoire à deux niveaux : 4 800 points fins injectés deviennent 1 164 points (188 horaires,
  976 fins), ordre strictement croissant, environ 4 704 relevés couverts — mais l'ancrage des
  points **fins** n'était pas respecté sur les points convertis, parce que les points de départ
  étaient désalignés (l'auteur dit que la mémoire existante est convertie d'elle-même) ;
- 37 → 12 textes sous le seuil de contraste AA (mesure sur la page servie, 1280×900) ;
- 2 474 CRLF et zéro LF isolé (vérifié en binaire) ;
- maquette ouverte en `file://` : aucune erreur, la démonstration garde ses courbes et ses cycles.

## Ce qu'il faut chercher en priorité

1. **`logEvent` a été réécrit** et passe désormais par `bornerEvents`. C'est le chemin d'écriture de
   tout le journal, de toutes les alertes et de toutes les notes : une erreur là dedans est
   silencieuse et globale. Vérifie le plafond, l'ordre, et que rien ne disparaît sans trace.
2. **La règle de fraîcheur contre la régulation.** Une valeur périmée devient absente (`null`).
   Que devient la régulation dans ce cas — s'arrête-t-elle proprement, ou peut-elle commander sur
   une valeur `null` ? C'est le point le plus sensible du lot.
3. **La compaction de la mémoire existante.** Des points fins désalignés, plus anciens que 48 h,
   sont-ils convertis correctement (moyenne pondérée, min, max, `n`) ? L'idempotence tient-elle ?
   Un trou de sonde peut-il être comblé par une heure regroupée ?
4. **Les identifiants SVG.** Un `clipPath` a été ajouté pour limiter le tracé à la zone du
   graphique. Si deux graphiques coexistent sur une page, deux `id` identiques se marchent dessus.
5. **La règle de l'axe vertical** (la consigne n'entre dans le cadre qu'à moins de 5 °C, ou si elle
   laisse un quart de la hauteur aux mesures, sinon un repère au bord). Est-elle cohérente sur tous
   les cas : lot terminé, « Tout », une seule mesure, mesures écartées ?
6. **La boîte des événements restaurés** : parcours clavier, focus, restitution ; et la question de
   fond — restaurer un événement fabriqué peut-il le faire passer de nouveau pour une commande
   réelle dans le journal d'un lot réel ?
7. Ce que **la passe casse** ailleurs : `archive`, `gravCfg`, le fil d'activité, la vue Appareils,
   l'en-tête d'état du pont (`etatPont`, `etatBadge`, `fraiche`).

## Rappel des lignes rouges

Le fichier doit rester **un seul fichier sans dépendance**, continuer de fonctionner ouvert en local
(`file://`, mode maquette), ne rien changer aux freins de régulation, ne retirer aucune marque
`demo`, et n'envoyer de commande que sur un clic de l'utilisateur ou une décision de `regulerPont`.

## Livrable

`design/revue-correctifs-4.md`, en français : pour chaque point, ce qui tient, ce qui est risqué, et
ce que tu proposes. Un verdict final : publiable en l'état, ou à corriger avant. Dis aussi ce que tu
n'as pas pu vérifier.
