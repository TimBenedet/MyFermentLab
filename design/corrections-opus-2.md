# Corrections Opus n° 2 : `scada-opus-5.5/hakko-dashboard.html`

Ce rapport répond à `design/brief-corrections-opus-2.md`, section « Corrections demandées », points 1
à 10. Les numéros de ligne renvoient au fichier livré, qui compte 2 576 lignes en CRLF.

J'ai modifié deux fichiers : le dashboard et ce rapport. Avant de commencer, j'ai copié l'état du
fichier dans `C:\tmp\hakko-verif-5\avant.html`. La passe fait **+127 / −25 lignes** par rapport à
cette copie (`git diff --no-index --ignore-cr-at-eol`). Par rapport à
`design/dashboard-apres-correctifs-1.html`, le total est de +545 / −121 lignes. Les scripts
d'essai sont tous dans `C:\tmp\hakko-verif-5\`.

## Ce que j'ai vérifié moi-même

| Script | Ce qu'il vérifie | Résultat |
|---|---|---|
| `statique.js` | Fins de ligne, `node --check` sur les deux `<script>`, freins comparés au caractère près à l'état d'avant la passe et à la sauvegarde | 2 576 CRLF, 0 LF isolé, 0 CR isolé ; syntaxe OK ; `regulerPont`, `regulerSecurite`, `regulMaitre`, `tick` et la ligne `AUTO_*` **identiques** à l'état d'avant la passe. (`tick` diffère de la sauvegarde par la ligne des watts de la passe n° 1, rien de plus.) Il reste 2 `delete d.demo`, 3 `demo:true` et 3 `pontRequete('prise'`, comme avant. |
| `s1-memoire.js` | Points 3, 9 et 10 dans Node, sur les fonctions extraites du fichier livré | 24 vérifications, toutes OK |
| `s1b-avant.js` | Les mêmes trous, rejoués sur l'ancienne découpe | L'ancienne version relie 3 des 4 trous testés : le test sait la prendre en défaut |
| `s2-dialogue.js` | Points 1, 2 et 8 dans Edge headless, page servie en HTTP par le faux pont | 24 vérifications, toutes OK ; aucune erreur JS ; **0 commande** reçue par le faux pont |
| `s3-courbe.js` | Points 4 à 7 et 9 dans Edge, plus le contraste des textes ajoutés, SVG compris, dans les deux thèmes | 22 vérifications, toutes OK ; 0 commande |
| `s4-fichier.js` | La maquette ouverte en `file://` (le fichier lui-même, rien d'injecté) | « Maquette locale », 4 vignettes sur 4, 26 entrées dans le fil, courbes b1 à b4 et archive tracées avec une légende complète, aucune exception |
| `r4-s1-regulation.js` et `r4-s3-compaction.js` | Les deux scénarios de la relecture n° 4, copiés et pointés sur mon faux pont | Voir plus bas |

**Scénarios de la relecture n° 4, rejoués.**

- **Régulation (S1).** Les résultats sont identiques à ceux de la relecture : une seule commande
  d'allumage (`auto: true`), « Sans mesure » à +11 min, coupure de sécurité à +46 min.
- **Défaut antérieur de « Terminer le lot » pendant une chauffe.** Il est toujours là :
  `TypeError` dans `regulerSecurite`. Je n'y ai pas touché, puisque la correction passe par les
  freins et attend la décision du propriétaire.
- **Compaction (S3).** Les trous de 2 h 54 et de 1 h 10 sont maintenant coupés, alors qu'ils
  étaient reliés avant.
- **Moyenne horaire.** La vérification « moyenne exacte à l'arrondi près » échoue **à
  l'identique sur l'ancienne et sur la nouvelle version**. L'écart vaut 0,0050, soit exactement
  le seuil du test : c'est une limite d'arrondi du test. Je n'ai pas touché au calcul de la
  moyenne de température.

---

## 1. Fil « Activité récente » : les événements restaurés sont marqués

**Fait.** `feedHTML` (l. 1515-1518) ajoute « (restauré, provenance non vérifiée) » après le texte
quand `e.restaure` est vrai. La formule et la classe `.muted` sont les mêmes que dans le journal du
lot (l. 1985). Le texte de la boîte de dialogue (« Restaurées, elles reviennent dans l'activité…
marquées comme non vérifiées ») devient donc vrai.

**Vérifié (`s2-dialogue.js`).** Après restauration, le fil affiche « Multiprise Tim Outlet 1 :
activation de la chauffe à 23,1 °C (restauré, provenance non vérifiée) ». Le journal du lot garde sa
marque. Pour le contraste de `.muted` sur une carte, j'ai mesuré 4,83 en clair et 5,77 en sombre.

## 2. « Tout restaurer » : confirmation, et un retour en arrière simple

**Fait.**

- **Confirmation** (l. 2473). Elle donne le nombre d'événements, dit ce qu'ils deviennent et
  précise jusqu'où on peut revenir : « Vous pourrez annuler tant que cette fenêtre reste ouverte ;
  une fois fermée, la restauration sera définitive. » Si on la refuse, rien n'est touché.
- **Retour en arrière : oui, et il reste léger** (`annulerRestauration`, l. 2206).
  - `restaurerEvenements` note les événements restaurés et la note de journal qu'elle écrit depuis
    l'ouverture de la boîte (`restaurationsOuvertes`, l. 2174).
  - Après une restauration, un bouton « Annuler la restauration » apparaît dans la boîte.
  - L'annulation rend l'état d'avant **à l'identique** : les événements retournent dans
    `S.eventsArchive` sans leur marque `restaure`, et les notes de restauration sont retirées du
    journal. L'état est enregistré.
  - À la fermeture de la boîte, la mémoire de l'annulation est effacée : la restauration devient
    définitive, comme la confirmation l'annonce.
  - Je n'ai pas fait d'annulation qui survive à la fermeture. Il faudrait alors un point d'entrée
    alors que l'archive est vide, et des événements qu'on pourrait remettre de côté à tout moment.
    Cela alourdirait la page.
- « Restaurer la sélection » ne demande pas de confirmation : c'est un geste ciblé, que l'on peut
  annuler de la même façon.
- La phrase d'explication de la boîte mentionne l'annulation possible.

**Vérifié (`s2-dialogue.js`).**

- Confirmation refusée : 3 événements dans l'archive, aucun restauré.
- « Restaurer la sélection » : aucune confirmation, 1 événement restauré.
- « Tout restaurer » confirmé : la confirmation annonce « les 2 événements » restants ; 3
  événements restaurés au total ; l'archive est vide et le bouton « Mis de côté » disparaît du
  fil.
- Annulation :
  - les 3 événements reviennent dans l'archive, sans clé `restaure` ;
  - les 2 notes de restauration sont retirées ;
  - le stockage est à jour ;
  - le fil ne montre plus l'événement ;
  - message « Restauration annulée : 3 événements remis de côté. », qui reçoit le focus.
- Après une fermeture puis une réouverture, le bouton « Annuler » n'est plus proposé.

**Non fait.** La relecture proposait aussi de plafonner à part les événements restaurés. Ce n'est
pas dans les points 1 à 10, et je ne l'ai pas fait.

## 3. Trous de sonde au niveau horaire

**Fait.** `rupture(prev, p)` (l. 967) remplace le test fixe de `decouper` (l. 974).

- **Entre deux points fins**, la règle ne change pas : une tranche manquante est tolérée (écart
  de deux pas au plus).
- **Dès qu'un point horaire est en jeu**, l'écart est mesuré depuis la **fin** de la plage du point
  précédent. Une heure pleine qui manque coupe donc la courbe : c'est le « > 1 × pas » du brief,
  entre deux heures.
- **Après une heure, quand le point suivant est fin** (jonction des 48 h), la tolérance d'une
  tranche est gardée, comme au niveau fin. Sans elle, une seule tranche absente juste après la
  limite aurait coupé la courbe, alors que le niveau fin la tolère.
- **J'ai ajouté une condition au brief.** On additionne à l'écart les tranches absentes des heures
  voisines (20 − n chacune), et la courbe est coupée si le total dépasse une heure. La raison : la
  seule règle « > 1 pas » ne suffit pas pour un trou de 1 h 10 **à cheval sur deux heures**, qui
  ne vide aucune heure entière. Par exemple, de 10:25 à 11:35, les heures 10 et 11 existent toutes
  les deux, à une heure d'écart, et la courbe resterait reliée. Avec le compte des tranches, tout
  trou de plus d'une heure coupe, quel que soit son alignement.
- L'amorce de `tempCfg` (l. 1303-1309) suit la même règle (`!rupture(a, s0)`), au lieu de
  l'ancien test à deux pas.

**Vérifié (`s1-memoire.js` sur 6 jours de mesures, `s1b-avant.js` sur l'ancienne version).**

| Cas | Avant | Après |
|---|---|---|
| Trou de 2 h 54 qui ne vide qu'une heure entière | 1 segment (relié) | 2 segments |
| Trou de 2 h 54 qui vide deux heures | 2 | 2 |
| Trou de 1 h 10 à cheval, sans heure vide | 1 (relié) | 2 |
| Trou de 1 h 10 qui vide une heure | 1 (relié) | 2 |
| Trou de 1 h 01 à cheval | (non testé) | 2 |
| Trou de 1 h 40 à la jonction des 48 h | 2 | 2 |
| Mémoire continue de 6 jours | 1 | 1 |
| Lot démarré en milieu d'heure (première heure à n = 4) | | 1, pas de fausse coupure |
| Trou de 30 min au niveau horaire | | 1 : invisible à cette résolution, voir plus bas |
| Pont qui perd une tranche sur trois | | 1, pas de fausse coupure |
| Une seule tranche absente juste après la jonction | | 1 |

Dans tous ces cas, `Σn` est conservé et la suite reste strictement croissante.

**Limite assumée.** Au niveau horaire, un trou de moins d'une heure ne se voit pas : on ne sait pas
où, dans l'heure, se trouvaient les tranches absentes. Une heure isolée entre deux trous forme un
segment d'un seul point. Elle s'affiche alors comme un point, grâce aux extrémités arrondies du
trait.

## 4. La cible garde sa décimale

**Fait** (`tempCfg`, l. 1325). Le libellé est `fmt(tg, 0)` si la consigne est entière, et
`fmt(tg, 1)` sinon. Le repère hors cadre et la ligne dans le cadre utilisent le même libellé.

**Vérifié (`s3-courbe.js`).**

| Cas | Affichage |
|---|---|
| Cible 18,5, mesures à 30 | « ▼ cible 18,5 °C, 11,5 °C plus bas » |
| Cible 28,1 | « cible 28,1 °C » |
| Cible 24 | « cible 24 °C », inchangé |

## 5. « Pas encore de mesure » quand la mémoire est plus ancienne que la plage

**Fait.**

- `tempCfg` (l. 1332) fournit un message `vide` quand la mémoire existe mais qu'aucun point ne
  tombe dans la plage. Par exemple : « Aucune mesure sur les dernières 24 h. Dernière mesure le
  1 oct. à 10:06. » La plage 7 j a son propre texte.
- La date est formée par `quandMesure` (l. 990). Pour un point horaire, elle devient « entre 14:00
  et 15:00 ».
- `drawChart` affiche ce message à la place de « Pas encore de mesure. », qui reste le texte quand
  il n'y a aucune mémoire.

**Vérifié (`s3-courbe.js`).**

- Mémoire vieille de 30 h, plage 24 h : on obtient exactement le message attendu, et la légende
  est masquée (voir point 7).
- Même mémoire, plage « Tout » : la courbe est tracée.
- Sans mémoire : « Pas encore de mesure. »

## 6. Repère hors cadre : de quand date la mesure

**Fait.**

- Quand il n'y a pas de mesure en direct (`cur == null`), `tempCfg` (l. 1328) passe à la ligne de
  consigne un texte `ecartSur`. Par exemple : « écart à la dernière mesure, à 14:06 », « … le
  1 oct. à 14:06 » si la mesure date d'un autre jour, ou « écart à la dernière moyenne horaire,
  le … entre … et … ».
- `drawChart` (l. 1195-1199) l'écrit sur **une seconde ligne** : sous le repère s'il est en haut,
  au-dessus s'il est en bas. Sur une seule ligne, le texte aurait débordé sur un écran de téléphone.
- Le texte est aussi ajouté entre parenthèses à l'`aria-label`.
- Avec une mesure en direct, la seconde ligne n'apparaît pas : l'écart porte alors sur la valeur
  du moment.

**Vérifié (`s3-courbe.js`).**

- Pont muet, dernière mesure il y a 2 h : on lit « écart à la dernière mesure, à 14:06 ».
  L'`aria-label` vaut « Courbe de température ; cible 18,5 °C, 11,5 °C plus bas (écart à la
  dernière mesure, à 14:06) ».
- Mesure de la veille (plage 7 j) : « … le 1 oct. à 14:06 ».
- Mesure en direct : une seule ligne, « ▲ cible 60 °C, 37,0 °C plus haut ».
- Contraste des deux lignes SVG (`--ink2` sur `--surface`) : 10,31 en clair, 10,58 en sombre.

## 7. Légende : n'annoncer que ce qui est tracé

**Fait.**

- Dans la vue détail, les entrées « Consigne » et « Plage tolérée » de la courbe de température
  portent `data-hors` (l. 1920).
- `drawChart` les masque quand la consigne est hors du cadre (l. 1201). Il masque toute la légende
  quand rien n'est tracé (l. 1146-1147).
- La règle est appliquée à chaque tracé : premier rendu, changement de plage, rafraîchissement en
  direct, changement de thème. La légende suit donc l'axe.
- L'archive, l'humidité et la densité ne sont pas concernées : leurs lignes ne sortent jamais du
  cadre.

**Vérifié (`s3-courbe.js`, `s4-fichier.js`).**

| Cas | Légende | Tracé |
|---|---|---|
| Cible hors du cadre | « Mesure » seule | ni bande ni ligne pointillée |
| Cible dans le cadre | les trois entrées | bande et ligne présentes |
| Changement de plage par le bouton | recalculée | |
| Maquette en `file://` (b1 à b4, archive) | complète | |

## 8. Focus après la fermeture de la boîte, et `indeterminate`

**Fait.**

- **Retour du focus.** Un écouteur `close` sur le `<dialog>` (l. 2218) agit quand la boîte des
  événements mis de côté se ferme et que le focus n'a pas été rendu à un élément visible. Il le
  donne alors, dans cet ordre :
  1. au **nouveau** bouton « Mis de côté », s'il existe ;
  2. sinon, au titre « Activité récente » ;
  3. sinon, au `h1` de la page (« Archive »).

  Un titre reçoit `tabindex="-1"` : on peut lui donner le focus par programme, mais il n'entre pas
  dans l'ordre de tabulation.
- **Ce que j'ai trouvé en le vérifiant.** À l'événement `close`, Chrome ne laisse pas le focus sur
  `body`, mais sur le message `#ev-msg`, **à l'intérieur de la boîte fermée** et donc invisible. Un
  test qui se contente de « le focus n'est pas sur `body` » ne voit pas le problème. Le correctif
  traite aussi ce cas (`!dlg.contains(a)`).
- **`indeterminate`.** Un gestionnaire `change` (l. 2497) met à jour « Tout sélectionner » :
  - coché si toutes les cases le sont ;
  - décoché si aucune ;
  - `indeterminate` si la sélection est partielle.

**Vérifié (`s2-dialogue.js`, bouton d'origine focalisé avant le clic, comme à la souris ou au
clavier).**

| Cas | Focus après fermeture |
|---|---|
| « Fermer » après une restauration | nouveau bouton « Mis de côté » |
| Échap sans restauration | bouton d'origine, rendu par le navigateur |
| Archive vidée, puis Échap | titre « Activité récente » |
| Page Archive vidée, croix de fermeture | `h1` « Archive » |

Pour « Tout sélectionner » :

- 1 case sur 3 : `indeterminate` ;
- 3 sur 3 : coché ;
- 0 sur 3 : décoché ;
- clic depuis l'état partiel : tout est coché.

## 9. La moyenne horaire est tracée au milieu de l'heure

**Corrigé, à l'affichage seulement.** La mémoire reste ancrée sur le début de l'heure et
strictement croissante.

- `tracer` (l. 987) place un point horaire à `heure + 30 min` pour la température et pour
  l'humidité. Il garde le début de l'heure en troisième champ, pour la bulle de survol : « 23,6 °C,
  moyenne du 27 sept. de 17:00 à 18:00 ».
- Le milieu est borné au départ du lot. La première heure, partielle, ne sort pas du cadre en plage
  « Tout » et n'est pas filtrée.
- Le filtre de fenêtre et l'amorce utilisent l'abscisse tracée. La découpe (point 3) travaille sur
  les horodatages mémorisés.
- `compacterHist`, `finish` et la vignette ne changent pas. La vignette ne trace que les dernières
  24 h, donc uniquement des points fins.

**Vérifié (`s1-memoire.js`, `s3-courbe.js`).**

- La mémoire reste sur `% HOUR`.
- Les abscisses tracées sont strictement croissantes.
- Une heure pleine est tracée à HH:30.
- La première heure partielle est bornée au départ du lot.
- À la jonction, 30 min séparent la dernière moyenne horaire du premier point fin.
- Dans le navigateur, un lot de 5 jours en plage « Tout » donne 1 segment.

## 10. Fusion « horloge reculée » : poids de l'humidité

**Fait.**

- Un point horaire peut porter un **septième champ facultatif, `nh`** : le nombre de tranches qui
  avaient une humidité. Il n'est écrit que si ce nombre diffère de `n` et n'est pas nul
  (l. 954). Une mémoire normale ne grossit donc pas.
- `nHum(p)` (l. 926) lit ce poids :
  - `p[6]` s'il existe ;
  - sinon `n` si le point a une humidité, ce qui correspond au comportement d'avant pour les
    points déjà convertis ;
  - sinon 0.
- La fusion (l. 949-950) pondère l'humidité par `nHum(prec)` et non plus par `prec[5]`.
- Rien d'autre ne lit l'indice 6. `pasDe` ne regarde que `length > 3`, et `finish` ne lit que les
  indices 1, 3, 4 et 5.

**Vérifié (`s1-memoire.js`).**

- Une heure de 20 tranches, dont 5 à 80 % d'humidité, reçoit 4 tranches à 40 %. Le résultat
  vaut **62,2 %** avec `nh` = 9, ce qui est la valeur exacte. L'ancien calcul donnait 73,3 %.
- La température fusionnée est juste : moyenne 21,67, min 20, max 30.
- Un ancien point sans `nh` garde le comportement d'avant et ne reçoit pas de septième champ.
- Un point sans humidité auquel on ajoute une tranche à 50 % donne 50 %, avec `nh` = 1.
- La compaction reste idempotente.

---

## Ce que je n'ai pas fait, et pourquoi

- **Freins de régulation, `tick`, pont** : je n'y ai pas touché, conformément aux règles absolues.
  Le défaut de « Terminer le lot » pendant une chauffe et la chauffe à l'aveugle jusqu'à
  `AUTO_MAX_ON` restent entiers. Ils attendent la décision du propriétaire.
- **Libellé des sondes sans entité** (« Sans nouvelles » pour toujours) et **plafond séparé des
  événements restaurés** : la relecture n° 4 les cite, mais ils ne figurent pas dans les points 1
  à 10.
- **Vignette** : elle ne découpe toujours pas les trous. Ce n'est pas demandé, et elle ne trace que
  les dernières 24 h.
- **Lecteur d'écran réel, Firefox, Safari** : non testés. J'ai seulement vérifié le focus, le
  clavier et les attributs dans Edge (Chromium).

## Où un test peut se tromper

- **Focus après fermeture.** Si le bouton d'origine n'a pas reçu le focus avant d'être cliqué (par
  exemple avec un `.click()` en JavaScript), le navigateur n'a rien à rendre. Le test du focus
  doit focaliser le bouton d'abord, comme le font la souris et le clavier. Autre piège : « le
  focus n'est pas sur `body` » ne suffit pas, puisque le focus peut rester dans la boîte fermée.
- **`confirm()`.** « Tout restaurer » appelle maintenant `confirm()`. Un harnais qui le remplace
  par `() => true` restaure tout, et un harnais qui ne le gère pas reste bloqué sur la boîte
  native.
- **Bulle de survol au niveau horaire.** Elle affiche une plage horaire (« de 17:00 à 18:00 ») et
  non une heure précise. Le point est placé à HH:30.
- **Découpe.** Un trou de moins d'une heure au niveau horaire ne coupe pas la courbe, et c'est
  voulu. Pour vérifier le point 3, prenez des trous d'au moins 1 h, alignés de façon défavorable
  (une seule heure vidée, ou à cheval sur deux heures).
- **Légende.** Les entrées masquées le sont par `style.display = 'none'`, pas par l'attribut
  `hidden`. Lisez le style calculé, pas la présence de l'élément.
