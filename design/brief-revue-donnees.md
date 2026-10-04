Tu es relecteur de sûreté. Tu ne modifies RIEN : tu écris un rapport.

Contexte : un dashboard de fermentation commande de VRAIES prises électriques (ceinture
chauffante dans un seau d'eau) via Home Assistant. Le propriétaire a posé cette règle :

  1. Pas de recette en cours -> rien ne fonctionne, toutes les prises off, aucune sonde lue.
  2. Recette en cours -> seules les prises et sondes liées comptent ; les autres off.
  3. Prise ON si la consigne n'est pas atteinte, OFF dès qu'elle l'est. TOUT côté serveur.
  4. Recette archivée -> prises et sondes libérées, même état que les non utilisées.
  5. Une prise non liée à un projet doit être affichée ET réellement éteinte.

Ce qui vient d'être fait (à relire) : les données de l'application (recettes, lots, appareils)
vivaient dans le localStorage de CHAQUE navigateur — donc deux vérités, et une recette supprimée
sur le PC restait active sur le téléphone, qui pouvait la faire chauffer. Elles passent côté
pont : document partagé versionné, et le pont DÉDUIT son plan de ce document (POST /api/regul
répond désormais 410 : plus aucune page ne dépose de plan).

À LIRE D'ABORD, en entier :
- `design/protocole-donnees-partagees-v2.md` : le contrat (c'est la référence ; signale tout
  écart entre le contrat et le code).
- `design/diff-a-relire.patch` : le diff complet à relire (1515 insertions).
- `design/pont-avant-donnees.py` : le pont AVANT la passe (point de comparaison gelé).
- `scada-opus-5.5/pont/pont.py` et `scada-opus-5.5/hakko-dashboard.html` : l'état actuel.

CE QUI NE DOIT PAS AVOIR BOUGÉ (vérifie-le, ne me crois pas) :
- Les freins : liste blanche des prises, frein d'une commande par minute et par prise, plafond
  de chauffe (90 min), coupure sur sonde muette (15 min), coupure sur mesure figée (1 h),
  `couper_orphelines`, `surveillance`, `valider_lot`, `commander_regule`, `lire_sonde`.
- Aucune dépendance nouvelle (bibliothèque standard seule côté pont, aucune compilation côté
  page, un seul fichier HTML).
- La page doit continuer de fonctionner ouverte en file:// sans pont.
- Les marques `demo` ne doivent pas avoir été retirées.

CHERCHE EN PRIORITÉ (par ordre de gravité) :
1. Tout chemin par lequel une prise peut rester allumée sans que personne ne la surveille :
   plan vidé, pont redémarré, document illisible, conflit de révision, 507 (stockage plein),
   appareil périmé qui réécrit, lot archivé qui redevient actif.
2. Toute perte de données possible : adoption qui écrase sans sauvegarde, 409 qui jette la
   version de l'utilisateur, migration, volume vidé, quota du navigateur plein.
3. Les écritures concurrentes : deux appareils, deux onglets, l'écriture en vol côté page, le
   verrou de fichier côté pont, la durabilité (fsync) et l'atomicité du remplacement.
4. Les incohérences entre le contrat et le code, et les commentaires qui MENTENT sur ce que
   fait le code (un commentaire faux est un défaut : il égare la prochaine lecture).

MÉTHODE IMPOSÉE : commence par l'inventaire des fonctions (identiques / modifiées / supprimées
/ nouvelles) entre `design/pont-avant-donnees.py` et `scada-opus-5.5/pont/pont.py`. « Aucune
fonction supprimée » est le premier fait de sûreté à établir. Puis lis en différentiel les
seules fonctions modifiées. Pour chaque fonction modifiée, dis dans quel SENS elle va :
resserrement de sécurité, neutre, ou régression.

LIVRABLE — écris `design/revue-donnees-partagees.md` DÈS QUE tu as de quoi le remplir, puis
complète-le au fil de ta lecture (ne le garde pas pour la fin : si tu épuises tes tours, je ne
dois pas me retrouver sans rapport). Structure :
- Verdict en une ligne : BLOQUANT / À CORRIGER / BON POUR LE SERVICE.
- Inventaire des fonctions, avec le sens de chaque modification.
- Un tableau des défauts : gravité (bloquant / à corriger / cosmétique), fichier:ligne,
  ce qui se passe concrètement, et la correction proposée.
- Ce que tu as vérifié et trouvé CORRECT (aussi important : ça borne ma confiance).
- Ce que tu n'as PAS pu vérifier, et pourquoi.

Sois impitoyable sur la sûreté et avare en compliments. Si tu ne trouves rien de bloquant,
dis-le clairement plutôt que d'inventer des remarques pour faire nombre.
