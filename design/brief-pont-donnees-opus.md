Tu écris le magasin de données partagé et la déduction du plan dans le pont Python.

Lis d'abord, en entier : `design/protocole-donnees-partagees-v2.md` (le contrat arbitré) et
`design/avis-protocole-donnees.md` (justifications). Chemins absolus sous
C:/Users/Timothée/Documents/IA/Hermes/MyFermentLab/.

Tu as le droit d'écrire dans DEUX fichiers, et deux seulement :
1. `scada-opus-5.5/pont/pont.py`
2. `design/rapport-pont-donnees-opus.md` (ton rapport)

Interdit de toucher : `scada-opus-5.5/hakko-dashboard.html`, `scada-opus-5.5/nginx.conf`,
`scada-opus-5.5/k8s/*`, et tous les fichiers de `scada-opus-5.5/_verify/`. Ces parties sont
tenues par d'autres.

À implémenter, strictement selon le contrat :
- §2.C : le magasin `donnees` (fichier JSON sur `/data/donnees.json`, écriture atomique + fsync +
  copie précédente), et le magasin `decisions` (`/data/decisions.jsonl`, une ligne JSON par
  décision, rotation à 256 Kio avec une génération conservée). Les décisions cessent de n'exister
  qu'en mémoire : elles sont écrites par le pont et servies par `GET /api/decisions?depuis=`.
- §3 : `GET /api/donnees/rev`, `GET /api/donnees`, `POST /api/donnees` — révision, 409 strict,
  `op` d'idempotence, 400 si `donnees` absent ou nul, 413 au-delà de 512 Kio, 507 sur échec
  d'écriture, verrou d'écriture, et 503 quand `PONT_AUTH` n'est pas un jeton. `POST /api/regul`
  renvoie désormais **410 Gone**.
- §4 : le plan est DÉDUIT du document, champ par champ (4.1), la consigne vient de la copie figée
  du lot (4.2), la sonde doit être de température (4.3), la garde `maj` empêche un lot archivé de
  remonter (4.4), la dégradation sur document illisible est bornée (4.5), ce qui est accepté à
  l'écriture mais refusé au plan est journalisé (4.6). `GET /api/regul` reste, en lecture seule,
  et porte `exclus[]`.

Ce qui ne doit pas changer de comportement, sous peine de refus : la liste blanche refusée en
entier, le frein d'une commande par minute, le plafond de 90 minutes, la coupure sur sonde muette
(15 min), la coupure sur mesure figée (1 h), le balayage des prises non réclamées, la validation
qui refuse une consigne hors bornes ou une sonde d'unité non thermique. Si tu dois modifier une
de ces fonctions, écris-le explicitement en tête de ton rapport, avec la raison et la ligne.

Contraintes : Python de la bibliothèque standard uniquement — aucune dépendance. Tout en
français (identifiants, commentaires, messages). Aucun `TODO`, `FIXME` ou `print` de mise au
point laissé derrière. Preuve exigée : la sortie RÉELLE de `python -m py_compile
scada-opus-5.5/pont/pont.py` et de tes propres essais, collée verbatim dans le rapport — pas de
résumé de ce qui aurait dû se passer. Écris ton rapport en français, avec les sections : ce que
j'ai implémenté, ce que j'ai changé dans le code de sûreté et pourquoi, ce que je n'ai pas pu
vérifier, ce qui reste ambigu dans le contrat.

Si une partie du contrat te paraît intenable, ne l'invente pas et ne la contourne pas en
silence : implémente la lecture la plus sûre et signale-le.
