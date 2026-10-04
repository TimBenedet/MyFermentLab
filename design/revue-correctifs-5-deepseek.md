# Relecture n° 5 (deepseek) : les correctifs de la passe Opus n° 3 (interrompue)

Fichier audité : `scada-opus-5.5/hakko-dashboard.html` (2 654 lignes, 196 189 octets),
comparé à `design/dashboard-apres-correctifs-1.html` (état antérieur, 157 790 octets).
Je n'ai **pas modifié le dashboard**. J'ai écrit ce rapport et mes scripts d'essai
dans `C:\tmp\hakko-verif-7\`. Tous les essais passent par un **faux pont** que j'ai écrit
moi-même (interception de `fetch`, aucun réseau réel) : **aucune commande d'allumage
(`allume: true`) n'a été envoyée nulle part, et la vraie prise n'a jamais été appelée**.

## Verdict

**À corriger avant publication.** Aucune des failles trouvées ne touche aux freins de
régulation ni à la sûreté (voir § Invariants, qui tiennent intégralement) : ce sont des
défauts d'affichage, de robustesse ou de véracité du rapport lui-même. Les corrections sont
courtes et localisées. Le clou de la passe — la clôture de lot qui envoie réellement l'ordre
d'arrêt — fonctionne (mesuré), mais deux de ses bords sont faux (événement non rattaché au
lot, et échec 401 silencieux), et la découpe de la vignette est invisible à l'œil.

---

## Points à corriger (aucun n'est un blocage de sûreté)

### 1. `couperPrise` : l'événement « coupée à la clôture » n'est PAS rattaché au lot
**Lignes 2519–2520** (`aCouper.forEach(...)` puis `d.batch = null`) et **ligne 1751**
(`logEvent('heat-off', ..., d.batch || null, { reel: true })`).

Le commentaire des lignes 2516–2517 affirme « Ordre d'arrêt réel, avant de libérer
l'appareil *(pour que l'événement reste rattaché au lot)* ». C'est **faux**. `couperPrise`
est asynchrone et n'est **pas** attendue (`couperPrise(d).catch(() => {})`) : elle suspend à
`await pontRequete(...)` (ligne 1733). La ligne 2520, exécutée de façon synchrone juste après,
met `d.batch = null`. Quand la réponse du pont arrive et que `couperPrise` reprend, `d.batch`
est déjà `null` : `logEvent(..., d.batch || null, ...)` écrit donc `b: null`.

**Preuve (exécution)** : scénario A ci-dessous, l'événement journalisé vaut
`{"x":"Ceinture seau : coupée à la clôture du lot","b":null,"reel":true}` (idem pour l'autre
prise). L'événement n'est rattaché à aucun lot. Conséquence limitée : de toute façon, cet
événement `heat-off` sans champ `tp` n'entre pas dans le journal du lot (`journalHTML` ne
garde que `heat-on/off` avec `tp != null`), et il reste visible dans le fil « Activité
récente ». Mais le commentaire est mensonger et l'intention (rattacher l'événement au lot)
n'est pas réalisée. Correctif trivial : capturer `d.batch` (ou l'id du lot) **avant** de
libérer, et le passer explicitement à `couperPrise`.

### 2. `couperPrise` : échec silencieux sur le chemin 401/403
**Lignes 1739–1742.**

```js
if (r.status === 401 || r.status === 403){
  if (!await pontSynchro(false)) return false;                       // retour SILENCIEUX
  try { r = await pontRequete('prise', { entite: d.eid, allume: false }); } catch(e){ return false; }  // SILENCIEUX
}
```

Les deux autres chemins d'échec (`catch` ligne 1734–1737, et `!r.ok` ligne 1744–1748)
affichent une `alert()` **et** écrivent un `logEvent('alert', …)`. Ce chemin-ci, non : si
`pontSynchro(false)` rend `false` (jeton saisi vide/cancellé, ou pont injoignable pendant la
re-synchro), ou si la seconde requête lève, `couperPrise` rend `false` **sans alerte et sans
journal**. Or la ligne 2520 a déjà posé `d.on = false` : la page affiche « éteinte » alors
que le relais peut rester fermé — exactement le mensonge que cette passe cherchait à éliminer,
réintroduit sur le cas d'un jeton périmé + prompt refusé. Ce n'est pas un « silence » total
(un `prompt()` apparaît), mais rien ne dit à l'utilisateur que la coupure a échoué.
Correctif : aligner ce chemin sur les deux autres (`alert` + `logEvent('alert', …)`).

### 3. Vignette : la découpe est invisible — l'abscisse est indexée par point, pas par le temps
**`sparkPath`, lignes 1259–1307**, en particulier **ligne 1295**
(`const pas = pts.length > 1 ? 100 / (pts.length - 1) : 0`) et la boucle **1299–1305**
(`d += (j ? 'L' : 'M') + ((k0 + j) * pas).toFixed(2) + ' ' + y(pts[k0 + j])`).

Le correctif émet bien un `M` au début de chaque segment (2 segments pour un trou, 1 sans),
mais l'abscisse de **chaque** point est `(k0+j) * pas`, c'est-à-dire **l'index du point dans
la liste aplatie**, pas son horodatage. Les segments sont donc posés **bout à bout** : le
trou ne crée aucun écart horizontal, seulement une rupture de polyligne entre deux points
**adjacents** (un `pas` ≈ 0,28 unité). À l'échelle d'affichage, avec un trait de 2 px
(`vector-effect: non-scaling-stroke`), cette rupture est invisible.

**Preuve (exécution)** : lot « trou 2 h » → 2 segments, abscisses 0 → 100, et **tous les
écarts entre points consécutifs valent ~0,28 unité, y compris à la jonction des deux
segments** (`hasBigJump: false`). La grande courbe (`drawChart`) utilise `sx(p[0])` (abscisse
temporelle) : un trou y laisse un vrai blanc. La vignette ne montre donc toujours **pas** le
trou, contrairement à ce que demande le brief (« applique-lui la même découpe »). Le `M`
supplémentaire est réel dans le `d` du chemin, mais sans effet visuel. Correctif : tracer
chaque segment sur une abscisse proportionnelle au temps (comme `drawChart`), ou au minimum
insérer un intervalle vide entre les segments.

### 4. Le « minimum 5,36 » de contraste est faux (le vrai minimum est 4,53)
Voir § « Contrastes » ci-dessous. La conclusion « aucun texte sous 4,5 » est **vraie**, mais
le chiffre « minimum 5,36 » avancé par l'assistant est **faux** : le minimum réel est 4,53
(compteur du lien de navigation **actif**, `.nav a .cnt` sur `--side-active`, thème clair),
que la sonde de l'assistant n'a pas mesuré.

---

## Ce que j'ai vérifié par exécution

- **Faux pont** : serveur HTTP local qui sert le fichier réel (lu, jamais écrit) ; `fetch`
  intercepté en tête de page ; `/api/prise` journalise le corps exact ; `/api/etat` renvoie
  un état fictif. Aucun réseau réel, aucune commande d'allumage.
- **Scénario A (clôture, 2 réelles allumées + 1 démo + 1 autre lot)** : confirmation qui
  nomme « Ceinture seau, Tapis chauffant » ; **exactement 2 requêtes**
  `[{"entite":"switch.outlet_4","allume":false},{"entite":"switch.outlet_2","allume":false}]` ;
  la prise démo (`o3`) et la prise d'un autre lot (`o1`) ne reçoivent **rien** ; 0 erreur JS.
- **Scénario B (annulation de la confirmation)** : **0 requête**, lot non archivé, 0 erreur.
- **Événement « coupée à la clôture »** : `b: null` pour les deux prises (point 1).
- **Vignette** : lot avec trou de 2 h → **2 segments**, lot témoin → **1 segment** ;
  abscisses **0 → 100** ; écarts entre points uniformes (~0,28) → trou **invisible** (point 3).
- **Contraste (SVG compris, parser corrigé pour `color-mix`/`color(srgb …)`)** :
  - Appareils clair : 76 textes, min **4,53**, **0 sous 4,5** ; sombre : 76, min 5,12, 0 sous 4,5.
  - Accueil (fil d'activité) clair : 62 textes, min **4,53**, 0 sous 4,5 ; sombre : 62, min 5,12, 0 sous 4,5.
  - Calcul hors navigateur (concordant) : `.nav a .cnt` actif clair = **4,5336** ;
    inactif clair 5,48 ; actif sombre 5,12 ; `--muted` sur surface 5,36.
- **Libellé « Sans entité »** : tableau Appareils → « Sonde à la main / Sans entité Home
  Assistant : ne remontera jamais de mesure / … / jamais / Sans entité » ; badge d'état avec
  `title="Sans entité Home Assistant : ne remontera jamais de mesure"` ; mesure « — ».
- **Syntaxe** : les deux `<script>` passent `node --check` / `new Function(...)`.
- **Freins** : `regulMaitre`, `regulerPont`, `regulerSecurite` et la ligne `AUTO_*`
  **identiques au caractère près** à `dashboard-apres-correctifs-1.html` (extraction par
  appariement d'accolades).

## Ce que j'ai vérifié par lecture seulement

- **Aucun `allume: true` littéral** : 0 occurrence dans tout le fichier. Les 5 appels
  `pontRequete('prise', …)` sont : 2 dans `couperPrise` (`allume: false` littéral), 2 dans
  `pontBascule` (`allume: voulu`), 1 dans `regulerPont` (`allume: voulu, auto: true`). Une
  seule commande d'allumage automatique possible, dans `regulerPont`, avec une variable.
- **Marques `demo` non retirées** : 3 `demo:true` (o1/o2/o3) et 2 `delete d.demo` (lignes
  2571, 2572) inchangées. La fonction `estDemo` a été supprimée, mais ce n'est pas une
  « marque » : ses quatre points d'appel (`sparkPath`, `tempCfg`, `humCfg`, `journalHTML`)
  ont tous été réécrits (vers `PONT_LOCAL` / `evVisible`), sans référence orpheline.
- **Hors maquette, aucune simulation** : `tick()` commence par `if (!PONT_LOCAL) continue;`
  (l. 1072) ; `d.value = model(...)` n'est atteint qu'en maquette. Les watts simulés sont
  `if (PONT_LOCAL) d.power = …` (l. 1115) et purgés hors maquette (`if (!PONT_LOCAL) …
  delete d.power`, l. 1649). `enregistrerTemperatures` n'appelle jamais `model` (il lit
  `currentTemp` = valeur réelle fraîche, et est barré par `sondeReelle(b)`). `model` ne
  sert plus qu'à l'archive/légende « reconstituées par le modèle » (affichage).
- **Aucune commande sur mesure absente/périmée** : `tick()` n'appelle `regulerPont` que sous
  `if (tp != null)` ; `currentTemp` rend `null` hors maquette pour une valeur sans `recu` frais.
  La coupure de sécurité (`regulerSecurite`) envoie `allume:false` sans dépendre de la
  température : direction sûre, conforme à la relecture n° 4.
- **Le chemin 401 silencieux** (point 2) : déduit de la lecture des lignes 1739–1742, non
  exécuté (nécessiterait de simuler un `prompt()` refusé).
- **« Reste du diff » (~1 000 lignes, passes opus-2 + opus-3)** : `logEvent`/`bornerEvents`,
  `save`, `pontApplique`, `pontSynchro`, `refreshLive`, `chauffe`, `surveillance`,
  `regulParCetOnglet` relus. `bornerEvents` exempte les événements `restaure` du plafond de
  500 (risque déjà signalé par la relecture n° 4, non aggravé ici). `surveillance`/`chauffe`/
  `regulParCetOnglet` sont en lecture seule, n'émettent aucune commande. Rien de cassé sur ces
  chemins partagés ; je ne prétends pas avoir rejoué chacun des scénarios de la relecture n° 4.

## Ce que je n'ai pas vérifié

- **Le matériel réel** (Home Assistant, Meross, chien de garde 90 min du pont) et le
  comportement du pont (`pont.py`) : je n'ai lu que le contrat `api/etat` / `api/prise`.
- **Le chemin 401/403 en conditions réelles** (prompt refusé, jeton expiré) : lecture seule.
- **Safari, Firefox, lecteur d'écran réel** : seul Edge (Chromium) headless a été utilisé.
- **La reproduction exacte des comptes « 42 textes » / « 8 textes » / « 359 points » /
  « 399 points »** de l'assistant : mes comptes diffèrent (76/62 textes, 362/401 points)
  parce que ma sonde est plus large (tout texte-feuille, SVG compris, barre latérale comprise)
  et que mon horloge/seed écrivent une tranche de plus. Les **ordres de grandeur et les
  conclusions** (segments, étendue 0–100, rien sous 4,5) sont confirmés, pas les chiffres exacts.

---

## Failles trouvées dans les affirmations de l'assistant

1. **« L'événement reste rattaché au lot »** (commentaire l. 2516–2517) : **faux** — mesuré
   `b: null` (point 1).
2. **« Coupure sur échec signalée elle-même »** : faux sur le chemin 401/403, qui échoue
   **silencieusement** (point 2).
3. **« La vignette découpe les trous comme la grande courbe »** : seulement en apparence. Les
   2 segments sont bien dans le `d` du chemin, mais l'abscisse indexée par point les colle
   bout à bout : le trou reste **invisible**. L'affirmation « un trou donne 2 segments, un
   témoin 1, étendue 0–100 » est **vraie** ; l'effet annoncé (trou visible) ne l'est **pas**.
4. **« Minimum de contraste 5,36 »** : **faux**. Le vrai minimum est 4,53 (compteur du lien de
   navigation actif, thème clair). La conclusion « aucun sous 4,5 » reste **vraie**, mais le
   chiffre avancé ne l'est pas — la sonde de l'assistant (sélecteur sans `.nav a .cnt`) a
   raté cet élément.

Ce qui est **exact** dans les affirmations, et confirmé à l'exécution : deux prises réelles
allumées + deux leurres donnent exactement deux requêtes `allume:false`, démo et autre lot
épargnés ; l'annulation ne commande rien ; le libellé « Sans entité … ne remontera jamais de
mesure » apparaît dans le tableau et le titre du badge ; les freins et constantes sont
identiques au caractère près ; aucun `allume: true` littéral ; marques `demo` conservées.

## Corrections proposées (toutes hors freins de régulation)

1. `couperPrise(d, lotId)` : journaliser `heat-off` avec le lot capturé avant libération.
2. Ajouter `alert` + `logEvent('alert', …)` au chemin 401/403 de `couperPrise`.
3. Vignette : abscisse proportionnelle au temps (ou intervalle vide entre segments).
4. Re-mesurer le contraste du compteur de navigation actif (4,53, très proche du seuil) et,
   si l'on veut tenir « rien sous 5 », l'assombrir d'un cran.
