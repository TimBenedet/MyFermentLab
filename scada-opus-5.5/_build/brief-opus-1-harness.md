# Mission : harnais de vérification headless — projet FermentationLab2

Tu écris **uniquement** dans le dossier `_verify/` du projet
`/mnt/c/Users/Timothée/Documents/IA/Hermes/FermentationLab2`.
Interdiction absolue de modifier `README.md`, `hakko-dashboard.html`, `_build/`, ou tout autre
fichier du projet. Tu ne crées pas de dépôt git.

## Contexte

L'application est un dashboard HTML autonome (un seul fichier, HTML + CSS + JS inline, sans build,
sans dépendance, français, `localStorage`). Elle est servie en HTTP sur deux origines
**différentes** (donc deux `localStorage` isolés) :

- **A — la référence (l'original)** : `http://127.0.0.1:8811/_verify/reference-original.html`
- **B — le build reconstruit** : `http://127.0.0.1:8812/hakko-dashboard.html`

La spécification normative est `README.md` : §10 (checklist d'acceptation, 8 points), §9 (mise en
page « un seul écran » et responsive), §6 (les 7 pages), §5 (données initiales), §3 (design system).
Lis-la avant d'écrire. Le code de l'application est lisible sur disque : sers-t'en pour connaître
les crochets `data-action`, les sélecteurs et les clés `localStorage` — pas pour recopier.

## Environnement (déjà en place, ne l'installe pas)

- `puppeteer-core@25.11.0` est **déjà installé** dans `_verify/node_modules`. N'exécute ni
  `npm install` ni `npm i` : aucune dépendance supplémentaire n'est autorisée.
- Node n'existe que côté Windows. Depuis le shell Linux, appelle `node.exe`
  (`/mnt/c/Program Files/nodejs/node.exe`) : l'interopérabilité WSL→Windows fonctionne et Edge sera
  lancé côté Windows. Exemple : `cd /mnt/c/Users/Timothée/Documents/IA/Hermes/FermentationLab2/_verify && node.exe verifie.mjs --a http://127.0.0.1:8811/_verify/reference-original.html`
- Microsoft Edge headless : `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`.

## Livrables

1. `_verify/verifie.mjs` — le harnais, en Node ESM.
2. `_verify/RAPPORT.md` — la sortie réelle des exécutions et tes conclusions.
Tu as aussi le droit d'écrire des fichiers de travail dans `_verify/` (rapports JSON, captures).

## Ce que le harnais doit faire

1. Prendre en arguments `--a URL`, `--b URL` (B optionnel), `--sortie DOSSIER`, et un mode
   `--cible a|b|deux`.
2. Lancer Edge headless (`headless:'shell'`, arguments `--no-sandbox --disable-gpu
   --hide-scrollbars --force-device-scale-factor=1`), et attacher les écouteurs **avant** le `goto` :
   erreurs et avertissements console (le 404 de `favicon.ico` est du bruit, filtre-le),
   `pageerror` avec la pile (`e.stack`, pas seulement `e.message`), réponses de statut ≥ 400,
   requêtes échouées.
3. Parcourir, pour chaque cible × chaque route × chaque thème, et aux viewports **1440x860** et
   **1280x720** :
   routes `#/`, `#/f/b1`, `#/archive`, `#/archive/b0`, `#/recettes`, `#/recettes/new`, `#/appareils` ;
   thèmes clair et sombre (`page.emulateMediaFeatures` **avant** le `goto`, plus la clé
   `hakko-theme` du `localStorage`) ;
   et mesurer : delta de défilement vertical et horizontal du document, débordements d'enfants hors
   de leur conteneur (ignorer les rects nuls et les éléments `display:none` ou non visibles),
   plus une capture PNG par cas dans le dossier de sortie.
4. Exécuter les **8 points de §10** par de vraies interactions (clic sur les éléments `data-action`,
   saisie dans les champs, rechargement de page pour la persistance) et lire les valeurs **dans le
   DOM ou l'état JavaScript, jamais dans une capture d'écran**. Chaque assertion doit imprimer
   l'attendu **et** l'obtenu.
5. Comparer A et B route par route : mêmes compteurs (nombre de tuiles de lot, de lignes de tableau,
   d'onglets, de prises), mêmes libellés, mêmes nombres. Normaliser ce qui est volatil (horloge
   `HH:MM:SS`, « il y a … », numéro de version de cache) et **lister chaque divergence** avec sa
   route et ses deux valeurs.
6. Imprimer un rapport JSON unique et un résumé lisible, et sortir avec un code non nul dès qu'une
   assertion échoue (le parent lira le code de sortie).
7. Prouver au moins une assertion négative : sur une **copie jetable** dans `_verify/`, casse
   volontairement deux propriétés vérifiées, montre que le harnais passe au rouge avec le message
   attendu, puis nettoie la copie. Un harnais qui n'a jamais échoué n'est pas testé.

## Pièges connus (coûteux si ignorés)

- Compter avec `page.$$eval` ; `page.$eval` lève une exception dès qu'un sélecteur ne matche rien et
  tue la course au lieu de rapporter 0.
- Un élément `display:none` renvoie un rect nul : comparé à une carte à `x=16` il se lit comme un
  débordement de 16 px. Filtrer sur le `display`/`visibility` calculés et sur les tailles nulles.
- Attendre au moins un tick de données (le rafraîchissement est de 3 s) après l'arrivée de la page,
  sinon on mesure la coquille vide.
- `prefers-color-scheme` doit être émulé avant le `goto`.
- Une région (liste, tableau) n'existe que sur l'écran qui la porte : mesurer l'« avant » sur cet
  écran, agir, revenir, mesurer l'« après ».

## Méthode imposée

- Développe et exécute le harnais **d'abord sur A**. Colle dans `_verify/RAPPORT.md` la sortie réelle
  (extraits bruts, pas de résumé inventé) et, pour chaque échec, tranche : défaut de l'application
  (cite la règle du README violée) ou défaut de ton harnais (corrige-le et relance).
- B peut ne pas exister encore au moment où tu commences : un 404 sur B n'est pas un échec de
  l'application. Réessaie B en fin de course si besoin, mais termine le harnais dans tous les cas.
- N'écris jamais « vérifié » sans la sortie brute correspondante juste au-dessus.
- Les serveurs HTTP sont **déjà lancés** sur 8811 et 8812 : n'en démarre aucun, ne tue aucun
  processus.
- N'utilise pas l'outil navigateur de l'assistant ; tout passe par ton harnais et `node.exe`.

## Réponse finale attendue (texte, pas de fichier en plus)

Liste des fichiers écrits, la ou les commandes exactes exécutées, la sortie réelle (chiffrée), les
échecs avec leur cause (application ou harnais), et une courte section « ce que je n'ai pas pu
vérifier ».
