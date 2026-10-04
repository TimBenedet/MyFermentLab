Tu es relecteur de sûreté. Tu as DÉJÀ relu cette passe et rendu un verdict BLOQUANT : ton
rapport est dans `design/revue-donnees-partagees.md` (relis-le d'abord, c'est le tien).

L'implémenteur dit avoir corrigé D1, D2, D4, D5, D6 et D7. Ta mission : VÉRIFIER, pas croire.

Le système commande de vraies prises électriques (résistances chauffantes dans des
fermentations). Un défaut ici fait chauffer un seau d'eau sans surveillance. Le défaut
historique du propriétaire : il a supprimé une recette sur son PC, son téléphone l'affichait
encore, et le pont a chauffé pour un lot qu'il croyait effacé.

CE QUI A CHANGÉ DEPUIS TON RAPPORT
- `design/diff-a-relire.patch` : le diff COMPLET en index (pont, page, manifeste, nginx).
- Fichiers sur disque : `scada-opus-5.5/pont/pont.py`, `scada-opus-5.5/hakko-dashboard.html`,
  `scada-opus-5.5/k8s/deployment.yaml`, `scada-opus-5.5/nginx.conf`.
- Corrections revendiquées :
  * D1 : les derniers `maj` sont persistés dans `donnees-meta.json` (clé `majs`, plafond
    MAJS_MAX), ils PRIMENT sur le document, ne reculent jamais (max), et une réapparition
    après suppression (`ressuscite_apres_suppression`) est traitée comme une résurrection
    même à `maj` ÉGAL. La comparaison ordinaire reste STRICTE (`<`) pour ne pas mettre en
    quarantaine un lot édité dans la même seconde.
  * D2 : `tour_lot` refuse d'ENGAGER une chauffe quand `echeance_gelee()` est vrai.
  * D4 : `"regule": _source_plan["lu"] > 0` côté pont ; `PONT.regule = !!(j.regule === true)`
    côté page. Le mode dégradé ne rend PAS la main non plus.
  * D5 : `sansMaj()` + `signatureDe()` normalisent des deux côtés.
  * D6 : `PONT_AUTH=jeton`, `PONT_JETON` non optionnel, `client_max_body_size 528k`,
    `strategy: Recreate`.
  * D7 : `GESTES_EDITION` (10 gestes explicites) testé à l'entrée du gestionnaire de clics.

CE QUE JE TE DEMANDE
1. Pour CHACUN de D1,D2,D4,D5,D6,D7 : la correction est-elle réelle et complète, ou
   partielle/contournable ? Donne le fichier:ligne. Si tu peux l'exécuter, exécute.
2. Les corrections ont-elles introduit des défauts NOUVEAUX ? Cherche en particulier :
   - une régression sur la quarantaine (un lot légitimement édité peut-il être exclu à tort,
     donc une fermentation s'arrêter sans raison ?) ;
   - `regule` toujours vrai : existe-t-il un cas où PERSONNE ne régule plus (ni page ni pont) ?
   - `GESTES_EDITION` : un geste modifiant les données partagées manque-t-il encore ?
   - la mémoire `majs` peut-elle croître sans fin, ou bloquer un lot pour toujours ?
3. D3, D8, D9 et C1..C7 ne sont PAS corrigés. Pour chacun : bloquant pour un déploiement
   aujourd'hui, ou acceptable ? Sois direct — « ne pas déployer » si c'est ton avis.
4. Les freins de régulation sont-ils toujours intacts ? (`commander`, `commander_regule`,
   `couper_orphelines`, `surveillance`, `valider_lot`, `lire_sonde`). Compare au point gelé
   `design/pont-avant-donnees.py`.
5. VERDICT en tête : BON POUR LE SERVICE / À CORRIGER (liste) / BLOQUANT (pourquoi).

CONTRAINTES
- Aucune dépendance nouvelle. Le pont reste sans dépendance (stdlib seule).
- Tu peux lire, exécuter des tests, lancer le pont en local. Les essais sont dans
  `scada-opus-5.5/_verify/` (`essai-donnees.py`, `verif-d1-lot-supprime.py`,
  `essai-deux-appareils.mjs`, `essai-file-local.mjs`, `essai-prise-non-liee.py`,
  `essai-decisions.py` qui prend `pont/pont.py` en argument).
- INTERDIT : joindre 192.168.1.51 (l'installation réelle), ou écrire un test qui envoie
  `allume=true` vers une vraie prise. Faux Home Assistant uniquement, boucle locale.
- N'écris PAS dans `pont.py` ni dans `hakko-dashboard.html` : tu relis, tu ne corriges pas.

LIVRABLE
Écris `design/revue-donnees-v2.md` DÈS TON CINQUIÈME TOUR (verdict provisoire + ce qui est
déjà établi), puis enrichis-le au fil de la relecture. N'attends pas la fin : un rapport
jamais écrit ne sert à personne. Cite fichier:ligne, et dis ce que tu as EXÉCUTÉ vs LU.
