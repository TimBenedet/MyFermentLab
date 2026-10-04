# Relecture — la régulation déplacée dans le pont

## Ce qui vient de changer, et pourquoi

Une fermentation dure des jours ; personne ne garde un onglet ouvert trois semaines. Tant que
la décision de chauffe était prise par la page (`regulerPont`, `regulerSecurite`, `tick`),
fermer la page arrêtait la régulation. Le propriétaire du matériel l'a dit sans détour :
« ça doit fonctionner même si la page est fermée ». La décision a donc été déplacée dans le
pont (`pont/pont.py`), qui tourne en permanence à côté de nginx dans le même pod.

## Les fichiers à relire

1. `scada-opus-5.5/pont/pont.py` — **le cœur**. Nouveautés :
   - `age_mesure`, `valider_lot`, `lire_sonde`, `etat_prise`, `noter`, `commander_regule`,
     `boucle_regulation`, `regulation` (nouveau fil démarré par `main`) ;
   - `PONT_SANS_MESURE_MAX` (défaut 15 min) dans `Config` ;
   - `GET /api/regul` et `POST /api/regul` ;
   - `fiche()` expose désormais `maj` et `maj_age` (horodatage de Home Assistant) ;
   - la boucle repousse `_echeances` quand la décision est « on continue de chauffer », pour
     qu'une chauffe longue et surveillée ne soit pas coupée par les 90 min de surveillance.
2. `scada-opus-5.5/hakko-dashboard.html` — **le côté page**. Nouveautés :
   - `planRegulation()`, `pontPoussePlan()`, `pontLireDecisions()` ;
   - `PONT.regule` coupe la régulation locale (`maitreRegul`, la ligne `regulerSecurite`)
     et le garde-fou local `couperSansMesure` ;
   - dans `pontSynchro` : dépôt du plan puis lecture des décisions du pont.
3. `scada-opus-5.5/k8s/deployment.yaml` — deux variables d'environnement et des commentaires.

## Lignes rouges (à ne pas franchir pendant la relecture)

- **Ne rien modifier.** Produire un rapport, pas des correctifs.
- **N'envoyer aucune commande à un matériel réel.** Aucun `allume: true` vers une prise
  physique. Les essais se font contre `_verify/faux-ha-regul.py`, jamais contre Home Assistant.
- Ne pas toucher au dépôt git, ne rien pousser.
- Pas de nouvelle dépendance : le pont n'utilise que la bibliothèque standard, c'est
  volontaire (pas d'installation dans l'image).

## Ce que je veux voir attaqué, en priorité

1. **La validation du plan** (`valider_lot`, la branche `POST /api/regul`) : peut-on faire
   commander au pont une prise hors `PONT_PRISES`, une sonde hors `PONT_SONDES`, ou une
   consigne aberrante ? Le « tout ou rien » est-il réellement tout ou rien ?
2. **La concurrence** : `regulation`, `surveillance` et les fils HTTP partagent `_verrou_plan`,
   `_verrou_echeances`, `_verrou_etat`. Y a-t-il un interblocage, une lecture sale, un plan
   modifié pendant qu'on le parcourt ?
3. **La coupure sur sonde muette** : le délai, le choix de `last_updated` (et non l'instant de
   lecture), le cas d'une sonde `unavailable`, le cas d'un horodatage illisible.
4. **Le garde-fou des 90 minutes** : la repousse d'échéance crée-t-elle un cas où plus rien ne
   coupe ? Que se passe-t-il si le plan disparaît (pod redémarré) alors qu'une prise chauffe ?
5. **Le frein d'une commande par minute** : bloque-t-il une coupure légitime ? (une minuterie
   qui expire pendant le frein, une fin de lot atteinte pendant le frein)
6. **La fin de lot** (`fin`) : une chauffe coupée à l'échéance, mais le lot reste-t-il actif et
   la boucle redémarre-t-elle la chauffe au tour suivant ? (je crois avoir laissé un défaut ici)
7. **Côté page** : `pontPoussePlan` peut-il envoyer un plan faux ou vide et laisser croire que
   la consigne est tenue ? `PONT.regule` peut-il rester vrai alors que le pont ne régule plus ?
   Deux régulateurs peuvent-ils commander en même temps ?
8. **Les mesures que j'annonce** : scepticisme exigé. J'affirme « le pont allume à 23 °C, coupe
   à 30,5 °C, coupe si la sonde se tait 7 min, et la page n'émet aucun ordre ». Ces mesures ont
   été prises avec le faux Home Assistant fourni, un plan à `sans_mesure_max: 60`, et un frein
   de 60 s observé à la seconde. Reproduis-les si tu peux, y compris en négatif.

## Livrable

`design/revue-pont-deepseek.md` : verdict en une ligne, puis pour chaque défaut : le fichier, la
ligne, ce qui est faux, comment le prouver, et la gravité (bloquant / à corriger / cosmétique).
Dis explicitement ce que tu n'as pas pu vérifier.
