# Mission : corriger D8 et D9 dans hakko-dashboard.html

Tu es Opus. Tu corriges DEUX defauts identifies par une revue de code, dans un dashboard de
fermentation qui commande de VRAIES prises electriques (ceinture chauffante sur un seau d'eau).
Un defaut ici peut faire chauffer une resistance sans surveillance.

Fichier a modifier : `scada-opus-5.5/hakko-dashboard.html` (UN SEUL fichier, rien d'autre).
Racine du depot : ce repertoire. Branche `Scada-opus-5.5`.

## Contexte : l'architecture des donnees partagees

Les recettes, lots et appareils vivent dans un document partage detenu par le pont (serveur
Python), versionne par une revision. Deux appareils (PC, telephone) le lisent et l'ecrivent.
La page garde un repli local (`localStorage`, cle `hakko-dashboard-v2`) et fonctionne aussi
ouverte en `file://` sans aucun pont.

Le defaut d'origine qu'on corrige depuis le debut : l'utilisateur a supprime une recette sur son
PC, son telephone l'affichait toujours, et le telephone aurait pu faire chauffer une prise pour
un lot que l'utilisateur croyait efface.

Quatre garde-fous existent, nommes G1 a G3 dans le code :
- G1 : si le pont a perdu ses donnees (sceau d'installation different), la page n'entreprend RIEN.
- G2 : un etat de demonstration ne se propose jamais comme reference partagee.
- G3 : **toute adoption sauvegarde d'abord l'etat courant**, en 3 generations (`MAX_SAUVEGARDES`).
- plus un gel en mode degrade (le pont sert une generation precedente).

## D8 — G3 echoue exactement quand elle sert

`adopterDocument()` appelle `sauvegarderLocal()`, puis **adopte quoi qu'il arrive**. Si le quota
du navigateur est plein, `sauvegarderLocal()` renvoie `null` et l'adoption se poursuit, en se
contentant d'un `logEvent` « (sauvegarde locale impossible : stockage plein) ».

G3 promet « adopter sauvegarde, toujours ». Elle echoue donc dans le seul cas ou elle sert :
stockage sature, c'est-a-dire beaucoup de donnees a perdre. L'utilisateur perd son travail et
ne lit l'explication qu'apres.

Correction demandee par la revue :
- si la sauvegarde echoue, **refuser l'adoption automatique** ;
- poser `PONT.divergence` avec un motif propre (p. ex. `sauvegardeImpossible`) ;
- exiger un export avant d'adopter (le bouton `data-action="exporter"` existe deja) ;
- dans le chemin MANUEL (`data-action="adopter"`), le dire dans le `confirm()` au lieu de
  promettre « votre version est conservee ».
- le bandeau `bandeauPartage()` doit AFFICHER ce nouvel etat, avec sa sortie : sinon la page
  decide de ne rien faire et l'utilisateur ne le sait pas. Chaque etat du bandeau a sa sortie
  nommee ; suis le modele des etats existants (`degrade`, `perdu`, `vierge`).

## D9 — « aucune adoption pendant une saisie » n'est applique qu'a moitie

La regle §6 du protocole : on n'adopte pas un document pendant que l'utilisateur saisit quelque
chose (un dialogue `<dialog id="dlg">` est ouvert) — sinon sa saisie est ecrasee sous ses doigts.

Le test `if (dlg && dlg.open) return;` n'existe QUE dans la branche « un autre appareil a
ecrit ». La branche de premiere lecture (`PONT.rev === null`) peut adopter automatiquement SANS
ce test.

Correction demandee : deplacer le test en tete de `pontSynchroDonnees`, juste apres la lecture
de la revision, pour qu'il couvre toutes les branches. Attention : un `return` en tete doit
quand meme passer par la fonction `fin()` qui redessine si l'etat d'alerte a change (voir plus
bas, c'est un defaut qu'on vient de corriger).

## LIGNES ROUGES — un manquement invalide tout le travail

1. **AUCUNE dependance nouvelle.** Pas de React, pas de Tailwind, pas de npm, aucune
   compilation. Un seul fichier HTML, du JavaScript nu.
2. **NE TOUCHE PAS aux freins de regulation** : `AUTO_*`, `regulerPont`, `regulerSecurite`,
   `regulMaitre`, la boucle de decision de `tick`, `PONT.regule`. Pas une ligne.
3. **Ne touche a AUCUN autre fichier.** Ni `pont/pont.py`, ni `k8s/`, ni `nginx.conf`, ni les
   essais dans `_verify/`. Si tu crois qu'un autre fichier doit changer, ECRIS-LE dans ton
   rapport, ne le modifie pas.
4. **Les fins de ligne sont CRLF.** Le fichier est integralement en CRLF : ne le convertis pas
   en LF, meme partiellement. Verifie avant de finir.
5. **La page doit continuer de fonctionner en `file://`**, sans pont, avec son jeu de
   demonstration.
6. **Ne retire aucune marque `demo`** ni la marque `ensemence`.
7. **N'ajoute jamais d'allumage de prise.** Aucune ligne de ta modification ne doit commander
   une prise.

## CE QUI NE DOIT PAS REGRESSER — verifie-le toi-meme

Trois batteries existent et passent actuellement. Tu dois les lancer et les rendre toutes vertes
AVANT de conclure. Depuis `scada-opus-5.5/_verify/` :

```
node essai-deux-appareils.mjs     # 13/13 — LE SYMPTOME D'ORIGINE, le plus important
node essai-file-local.mjs         # 12/12 — la page ouverte en file://
node verif-d7-marque-demo.mjs     # 5/5  — la marque de demonstration
```

`node_modules` est deja installe dans `_verify/`. Ces essais lancent de vrais navigateurs Edge
headless et un vrai pont Python : ils sont lents (20 a 60 s chacun), c'est normal.

**AVERTISSEMENT, apprends de mon erreur.** En corrigeant D7 j'ai casse `essai-deux-appareils`
(13/13 -> 11/13) : ma correction faisait tomber la marque de demonstration des le chargement,
donc un navigateur neuf refusait d'adopter les donnees du pont, et le symptome d'origine
revenait. J'ai mis trois tentatives a le comprendre parce que je devinais au lieu de mesurer.
**Lance les trois batteries apres chaque modification, pas seulement a la fin.**

Si une assertion echoue et que tu crois que c'est l'essai qui a tort, DEMONTRE-LE (mesure,
sortie de console) ; ne modifie pas l'essai pour le rendre vert.

## Deux details du code que tu dois connaitre

- `pontSynchroDonnees()` commence par `const avant = JSON.stringify(PONT.divergence || null);`
  et definit `const fin = () => { if (... !== avant) render(); };`. **Toute sortie de cette
  fonction doit passer par `fin()`** : sans cela la page pose une alerte sans redessiner, et
  l'utilisateur croit ses donnees partagees alors qu'elles dorment dans son navigateur. C'est un
  defaut qu'on vient de corriger, ne le reintroduis pas.
- Les numeros de ligne de la revue sont PERIMES (le fichier a change). Localise par nom de
  fonction : `adopterDocument`, `sauvegarderLocal`, `MAX_SAUVEGARDES`, `pontSynchroDonnees`,
  `bandeauPartage`, et le gestionnaire qui teste `data-action`.

## Livrable

1. Les corrections dans `scada-opus-5.5/hakko-dashboard.html`.
2. Les trois batteries ci-dessus **toutes vertes**, avec leur sortie reelle.
3. Un rapport dans `design/revue-d8-d9.md` contenant :
   - ce que tu as change, et pourquoi, fonction par fonction ;
   - la sortie reelle des trois batteries (copie-collee, pas resumee) ;
   - **un controle negatif** : reintroduis chacune des deux corrections a l'envers sur une
     copie, montre que la mesure passe au rouge, puis retablis. Si tu ne peux pas le faire,
     dis-le explicitement.
   - ce que tu n'as PAS pu verifier, et pourquoi ;
   - toute ligne rouge que tu as du frôler, et pourquoi.

**ECRIS LE RAPPORT AU FUR ET A MESURE**, pas a la fin : une session precedente a ete coupee a la
limite de tours et n'a laisse aucun rapport, seulement du code que personne n'avait verifie.

Commence par lire le fichier et les trois essais. Ne modifie rien avant d'avoir compris
comment `adopterDocument` est appelee depuis les deux chemins (automatique et manuel).
