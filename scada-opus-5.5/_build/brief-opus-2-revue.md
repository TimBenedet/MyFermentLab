# Mission : revue qualité du dashboard Hakko — projet FermentationLab2

Tu es le relecteur. Tu écris **uniquement** dans `_verify/revue-opus.md`.
Interdiction de modifier `README.md`, `hakko-dashboard.html`, `_build/`, `_verify/verifie.mjs`,
ou tout autre fichier.

## Objet

`hakko-dashboard.html` (racine du projet) est le dashboard livré : un seul fichier autonome
(HTML + CSS + JavaScript inline, sans build ni dépendance, en français).
`README.md` est la spécification normative : §3 (design system, jetons), §5 (données),
§6 (les 7 pages), §7 (formats), §8 (logique et simulation), §9 (mise en page « un seul écran »),
§10 (checklist d'acceptation). Ses annexes A/B/C contiennent le code source de référence.

Le fichier livré a été **reconstruit par transcription verbatim** des annexes, puis assemblé :
`sha256(hakko-dashboard.html) == sha256(_verify/reference-original.html)`. Ce fait est établi et
n'est PAS à reverifier comme un résultat de ta revue : ta mission est ailleurs.

## Deux questions, dans cet ordre

1. **La spécification et le code de référence sont-ils cohérents entre eux, et conformes aux
   captures d'écran du dossier ?** Les captures sont les fichiers PNG à la racine du projet
   (`Accueil.png`, `bière.png`, `Capture d'écran 2026-09-23 0844*.png`) : ce sont des captures de
   l'application de référence en thème sombre. Toute divergence entre la prose du README (§1 à §10)
   et le comportement réel du code est un défaut à citer.
2. **Quels défauts réels portent le fichier livré ?** Pas d'opinion de style : des faits, avec
   `fichier:ligne`, et la règle du README violée.

## Moyens (c'est la partie importante)

Tu as le droit d'exécuter du code et de lire l'état réel de l'application. Deux origines servies :
- A (référence) : `http://127.0.0.1:8811/_verify/reference-original.html`
- B (livré) : `http://127.0.0.1:8812/hakko-dashboard.html`
Serveurs déjà lancés : n'en démarre aucun, ne tue aucun processus.
`puppeteer-core@25.11.0` est déjà installé dans `_verify/node_modules` (n'exécute ni npm install ni
npm i). Node n'existe que côté Windows : appelle `node.exe`. Edge :
`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`.

Un harnais existe déjà : `_verify/verifie.mjs` et son rapport `_verify/RAPPORT.md`. **Lis-les et
sers-t'en** : leurs résultats sont des faits acquis. Ta valeur ajoutée, c'est ce que le harnais ne
regarde pas :

- les **chiffres affichés** contre les **chiffres recalculés** : reprends par exemple les formules
  de §8 (`model`, `tgt`, `setAt`, `status`, `archStats`) et vérifie que ce que l'écran montre
  correspond à ce que la logique calcule (une densité, un pourcentage d'alcool estimé, un
  « x % / consigne », un écart `tp − tg`, un `% dans la plage`) ;
- les **formats français** de §7 : virgule décimale, `fmtDur`, `ago`, libellés de progression,
  signe moins U+2212 et non le trait d'union ASCII, espace insécable avant `°C` et `%` ;
- la **fidélité des libellés** de l'interface : compare texte par texte ce que §5 et §6 annoncent
  avec ce que le DOM affiche réellement (extrais les libellés, ne les lis pas d'une image) ;
- les **cas limites** que la checklist §10 ne couvre pas : lot sans sonde, prise hors ligne, lot de
  moins de 3 jours (pas de 7 j), onglet Densité d'une bière sans relevé, recherche sans résultat,
  recette sans ingrédient, multiprise avec une prise libre ;
- l'accessibilité de base des contrôles (rôles, `aria-*`, focus) si tu y trouves un vrai défaut.

Toute affirmation doit être adossée à une sortie réelle que tu colles, pas à une lecture d'image :
le texte de l'interface se lit dans le DOM, jamais dans une capture réduite.

## Rendu : `_verify/revue-opus.md`

Structure imposée :
1. **Ce qui est correct, à conserver** (court, factuel) ;
2. **Défauts**, par sévérité décroissante (**bloquant**, **majeur**, **mineur**), chacun avec
   `fichier:ligne`, la règle violée, la preuve (sortie brute ou extrait de DOM), et le correctif
   suggéré en une phrase ;
3. **Ce que je n'ai pas pu vérifier**, et pourquoi.
Interdit : compliment générique, recommandation non applicable, défaut sans `fichier:ligne`.
Si tu ne peux pas citer `fichier:ligne`, tu ne l'écris pas.

Dans ta réponse finale (texte), donne : le nombre de défauts par sévérité, la liste courte des
titres, et le chemin du rapport.
