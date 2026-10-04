# Correction de D8 et D9 — `scada-opus-5.5/hakko-dashboard.html`

Rapport écrit au fur et à mesure. Branche `Scada-opus-5.5`. Un seul fichier de production
modifié : `scada-opus-5.5/hakko-dashboard.html`.

## 0. État de départ (mesuré avant toute modification)

Fins de ligne : `3251` lignes au total, `3251` terminées par CRLF — le fichier est
intégralement en CRLF. `git ls-files --eol` donne `i/lf w/crlf`, c'est-à-dire LF dans l'index
et CRLF dans la copie de travail : c'est la normalisation git habituelle, la copie de travail
doit rester en CRLF. Ce comptage est refait à la fin.

### Les chemins qui appellent `adopterDocument`

Avant de toucher quoi que ce soit, les trois appels — le brief en annonçait deux
(« automatique » et « manuel ») ; il y en a **trois**, parce que le chemin automatique en
contient deux, dans deux branches différentes de `pontSynchroDonnees`, avec deux conditions
différentes. C'est cette distinction qui gouverne toute la correction D8 :

| # | Chemin | Emplacement | Condition |
|---|--------|-------------|-----------|
| A | automatique, première lecture | `pontSynchroDonnees`, branche `PONT.rev === null` | `etatEnsemence()` vrai et les signatures diffèrent |
| B | automatique, un autre appareil a écrit | `pontSynchroDonnees`, branche `tete.rev !== PONT.rev` | `signaturePartagee() === PONT.sigEcrite` (rien de local à perdre) |
| C | manuel | gestionnaire `click`, `act === 'adopter'` | l'utilisateur clique « Adopter celles du pont » et confirme |

Dans les trois cas, `adopterDocument` appelait `sauvegarderLocal('hakko-dashboard-v2-remplace-')`
puis **continuait quoi qu'il arrive**, en se contentant d'un suffixe de `logEvent`. Les trois
appelants ignoraient la valeur de retour (`A` et `B` ne la lisaient pas, `C` non plus).

Baseline des trois batteries : voir §3.1, mesurée avant modification.

## 1. D8 — G3 échoue exactement quand elle sert

Le principe retenu : **G3 est une précondition, pas une tentative.** Une adoption ne commence
pas si la copie de sauvegarde n'a pas été écrite. L'exception unique est le chemin manuel,
après export, où c'est l'utilisateur qui accepte la perte en la connaissant.

### `adopterDocument(doc, options)`

- Nouveau second paramètre `options`. `options.sansSauvegarde` est le seul moyen d'adopter sans
  copie, et **seul le chemin manuel l'utilise**, après export. Aucun chemin automatique ne peut
  forcer : il n'y a pas d'appelant automatique qui passe cette option.
- Si `sauvegarderLocal()` renvoie `null` et que l'adoption n'est pas forcée, la fonction
  journalise une alerte et **renvoie `false` sans avoir muté `S`**. Point important : le refus
  arrive avant toute mutation — `sauvegarderLocal` écrit sous une clé distincte
  (`hakko-dashboard-v2-remplace-<t>`), donc l'état de l'utilisateur est intact, pas à moitié
  remplacé.
- Le `logEvent` final ne dit plus « (sauvegarde locale impossible : stockage plein) » sur un ton
  de note de bas de page. Ce suffixe n'est désormais atteignable que par une adoption forcée, et
  il dit ce qui est vrai : « SANS copie de sauvegarde […] votre version précédente n'existe plus
  que dans votre export ».
- **L'alerte de refus est bornée à une par dix minutes** (`PONT.refusT`). Le refus est réévalué
  à chaque synchronisation tant que le stockage reste plein, c'est-à-dire **toutes les 15
  secondes** (un tour sur cinq de la boucle de 3 s — voir §4.2, j'avais d'abord écrit « trois
  secondes » dans le code, c'était faux et c'est corrigé) : sans borne, le journal se
  remplissait d'alertes identiques et en chassait les
  vraies commandes de prise. C'est exactement le raisonnement — et la même cadence — que le
  commentaire existant de `alerteStockage`, que j'ai suivi plutôt que d'inventer autre chose.
  Je n'avais pas vu ce point en écrivant la correction ; il est venu en relisant ce que la
  boucle de synchronisation fait réellement d'un refus. L'état, lui, reste visible en
  permanence dans le bandeau — c'est son rôle, pas celui du journal.

### `pontSynchroDonnees` — les deux chemins automatiques

Les deux appelants automatiques lisaient la valeur de retour… en ne la lisant pas. Ils la lisent
maintenant, et en cas de refus posent `PONT.divergence = { rev, doc, motif: 'sauvegardeImpossible' }`
puis sortent par `fin()`.

- **Chemin A** (première lecture) : `if (signaturePartagee() !== signatureDe(j.donnees) && !adopterDocument(j.donnees))`
  → divergence + `return fin()`. Sans le `return`, la page aurait enchaîné sur
  `PONT.sigEcrite = signaturePartagee()`, c'est-à-dire déclaré « je suis à jour » alors qu'elle
  venait de refuser d'adopter.
- **Chemin B** (un autre appareil a écrit) : `PONT.rev` et `PONT.sigEcrite` ne sont avancés
  **que si l'adoption a réussi**. C'est le point le plus facile à rater : avancer `PONT.rev`
  après un refus faisait croire à la page qu'elle était à jour, et au tour suivant la branche
  « même révision des deux côtés » aurait fait disparaître le bandeau sans rien avoir adopté.
- `ecrireSceau(j.semence, j.rev)` est également passé sous la réussite : sceller une révision
  qu'on n'a pas adoptée aurait menti au garde-fou G1.

### Chemin manuel (`data-action="adopter"`)

- `const sansFilet = D.motif === 'sauvegardeImpossible'`.
- Si `sansFilet` et qu'aucun export n'a eu lieu dans cette session (`!PONT.exportT`) :
  `alert()` qui **exige l'export**, et retour. Pas de `confirm()` : on ne propose pas un choix
  dont une branche est une perte silencieuse.
- Si `sansFilet` et qu'un export a eu lieu : le `confirm()` ne promet plus « votre version est
  conservée dans ce navigateur » — il dit « AUCUNE copie de sauvegarde ne sera conservée ici »
  et **rappelle la date et l'heure de l'export** sur lequel l'utilisateur s'appuie. C'était la
  demande explicite de la revue.
- `adopterDocument` est appelée avec `{ sansSauvegarde: sansFilet }`, et si elle refuse malgré
  tout (le quota s'est rempli entre l'affichage du bandeau et le clic), on bascule la divergence
  sur `sauvegardeImpossible` et on redessine, au lieu de laisser croire que c'est fait.

### `PONT.exportT` et `data-action="exporter"`

- `exportT: 0` ajouté à l'objet `PONT`, documenté sur place.
- L'action `exporter` pose `PONT.exportT = now()` après le `click()` du lien de téléchargement.
- Volontairement **en mémoire et pas dans `localStorage`** : c'est précisément quand le stockage
  est plein que cette trace sert (l'y écrire échouerait), et un export d'avant un rechargement
  ne dit rien de l'état qu'on s'apprête à perdre.

### `bandeauPartage()` — le nouvel état et sa sortie

Nouvelle branche placée **avant** la divergence générique (sinon le message générique, qui
promet « votre version est conservée », l'aurait absorbée et aurait menti) :

- elle dit l'état (stockage plein, copie impossible) ;
- elle dit la conséquence (« n'ont donc **pas** été adoptées — les vôtres sont intactes ») ;
- elle porte sa sortie dans l'ordre où il faut l'emprunter : **exporter**, puis **adopter**,
  avec **garder les miennes** comme troisième issue. Le bouton d'export est placé en premier,
  avant « Adopter », contrairement aux autres états où il est en dernier : ici l'ordre de lecture
  est l'ordre de l'opération.

## 2. D9 — « aucune adoption pendant une saisie »

Le test `if (dlg && dlg.open) return;` a été **retiré** de la branche `tete.rev !== PONT.rev` et
**placé en tête** de `pontSynchroDonnees`, juste après `const tete = await pontLireRev();` et son
`if (!tete) return fin();`.

- La sortie est `return fin()` et non `return` : à cet endroit `fin()` est démontrablement un
  no-op (rien n'a encore pu modifier `PONT.divergence` depuis `avant`), mais l'invariant de la
  fonction est « toute sortie passe par `fin()` », et un invariant qui souffre une exception
  n'est plus un invariant — c'est exactement ainsi que D8 et D9 sont nés.
- Il couvre maintenant **toutes** les branches : dégradé, G1 (`perdu`), pont vierge, première
  lecture (`PONT.rev === null`) — celle qui était trouée — un autre appareil a écrit, et le
  dépôt de notre propre projection.
- Couvrir aussi le **dépôt** est un effet de bord assumé : pendant qu'un dialogue est ouvert, la
  page n'envoie pas sa projection au pont. Rien n'est perdu — `PONT.sigEcrite` est inchangé,
  donc le tour suivant (3 s) l'enverra. En échange, aucune branche ne peut plus adopter sous les
  doigts de l'utilisateur.
- Au passage, les quatre sorties `return;` nues de la branche « première lecture » (échec réseau
  ou JSON illisible lors du `GET /api/donnees`) sont devenues `return fin();`, comme celles de la
  branche « un autre appareil a écrit » que la correction D9 réécrivait de toute façon. Même
  invariant, aucun changement de comportement : à ces points non plus `PONT.divergence` n'a pu
  changer.

## 3. Mesures

### 3.1 Baseline — AVANT modification, les trois batteries sont vertes

Sortie réelle, copiée telle quelle :

```
=== BASELINE essai-deux-appareils ===
    [A api] 200 /api/donnees/rev
    [diag A] {"rev":0,"actif":true,"jetonRequis":false,"partage":true,"divergence":"{\"vierge\":true,\"ensemence\":false}","ensemence":false,"lots":1,"recettes":1,"pontRev":null}
  OK   A (données réelles) propose de devenir la référence
  OK   le bouton « Exporter mes données » est présent
    [A api] 200 /api/donnees
  OK   le pont détient le document partagé — rev 1
  OK   le lot « Test eau #1 » est dans la vérité partagée
    [B api] 200 /api/donnees/rev
    [B api] 200 /api/donnees
  OK   B (navigateur neuf) reçoit le lot sans rien saisir
    [diag B] {"rev":1,"div":"null","sigEcrite":true,"recettes":1,"sigEgale":"n/a"}
  OK   B n’a pas gardé les recettes de démonstration
    [ouverture] {"ok":true,"avant":{"hash":"#/f/b1","titre":"Test eau #1"},"apres":{"titre":"Test eau #1"}}
  OK   A ouvre la fiche du lot en cours
  OK   A termine le lot (geste réel : annuler / archiver)
    [apres suppression sur A] {"lots":1,"sigEcrite":"{\"recettes\":[{\"id\":\"r1\",\"name\":\"Test eau\",\"type\":\"koji\",\"dur","sigNow":"{\"recettes\":[{\"id\":\"r1\",\"name\":\"Test eau\",\"type\":\"koji\",\"dur","rev":1,"divergence":"null","enVol":false,"egales":false}
    [A api] 200 /api/etat
    [A api] 200 /api/regul
    [A api] 200 /api/donnees/rev
    [A api] 200 /api/donnees
  OK   le lot n’est plus actif dans la vérité partagée (A → pont)
    [B api] 200 /api/donnees/rev
    [B api] 200 /api/donnees
  OK   B voit l’archivage fait sur A (LE SYMPTÔME D’ORIGINE)
  OK   G2 : un navigateur neuf n’écrase pas la vérité avec ses données de démo
  OK   aucun allumage de prise pendant tout l’essai — aucune commande

---
Réussies : 13 | Échouées : 0 | Total : 13
VERDICT : SUCCÈS
=== BASELINE essai-file-local ===
  OK   aucune erreur JavaScript en file://
    [file://] {"local":true,"lots":5,"recettes":6,"appareils":9,"titre":"Vue d’ensemble","vide":24227,"bandeau":true,"partage":false,"proposePartage":false}
  OK   la page se sait en mode local (PONT_LOCAL)
  OK   la vue est rendue (pas de page blanche) — 24227 caractères
  OK   le jeu de démonstration est présent — 6 recettes, 9 appareils
  OK   la page ne prétend PAS que ses données sont partagées
  OK   aucun bouton de partage proposé sans pont
  OK   le bouton Exporter reste atteignable hors ligne
  OK   aucun appel réseau vers une API
  OK   la fiche d’un lot s’ouvre en file:// — Miso d’orge 2026
  OK   la vue Appareils liste le parc — 9 entrées
  OK   aucun « undefined » affiché à l’écran
  OK   toujours aucune erreur JavaScript après navigation

---
Réussies : 12 | Échouées : 0 | Total : 12
VERDICT : SUCCÈS
=== BASELINE verif-d7 ===
  OK   terminer un lot (archivage) — vivant true -> undefined, écrit undefined
  OK   rattacher un appareil à un lot — vivant true -> undefined, écrit undefined
  OK   changer le mode d’un appareil — vivant true -> undefined, écrit undefined
  OK   ajouter une note au journal — vivant true -> undefined, écrit undefined
  OK   ajouter un relevé de densité — vivant true -> undefined, écrit undefined

---
Réussies : 5 | Échouées : 0 | Total : 5
VERDICT : SUCCÈS
```

### 3.2 Après correction — les trois batteries restent vertes

Sortie réelle, copiée telle quelle :

```
=== APRES D8+D9 : essai-deux-appareils ===
    [A api] 200 /api/donnees/rev
    [A console] Failed to load resource: the server responded with a status of 404 (Not Found)
    [A api] 200 /api/donnees/rev
    [diag A] {"rev":0,"actif":true,"jetonRequis":false,"partage":true,"divergence":"{\"vierge\":true,\"ensemence\":false}","ensemence":false,"lots":1,"recettes":1,"pontRev":null}
  OK   A (données réelles) propose de devenir la référence
  OK   le bouton « Exporter mes données » est présent
    [A api] 200 /api/donnees
  OK   le pont détient le document partagé — rev 1
  OK   le lot « Test eau #1 » est dans la vérité partagée
    [B api] 200 /api/donnees/rev
    [B api] 200 /api/donnees
  OK   B (navigateur neuf) reçoit le lot sans rien saisir
    [diag B] {"rev":1,"div":"null","sigEcrite":true,"recettes":1,"sigEgale":"n/a"}
  OK   B n’a pas gardé les recettes de démonstration
    [ouverture] {"ok":true,"avant":{"hash":"#/f/b1","titre":"Test eau #1"},"apres":{"titre":"Test eau #1"}}
  OK   A ouvre la fiche du lot en cours
  OK   A termine le lot (geste réel : annuler / archiver)
    [apres suppression sur A] {"lots":1,"sigEcrite":"{\"recettes\":[{\"id\":\"r1\",\"name\":\"Test eau\",\"type\":\"koji\",\"dur","sigNow":"{\"recettes\":[{\"id\":\"r1\",\"name\":\"Test eau\",\"type\":\"koji\",\"dur","rev":1,"divergence":"null","enVol":false,"egales":false}
    [A api] 200 /api/etat
    [A api] 200 /api/regul
    [A api] 200 /api/donnees/rev
    [A api] 200 /api/donnees
  OK   le lot n’est plus actif dans la vérité partagée (A → pont)
    [B api] 200 /api/donnees/rev
    [B api] 200 /api/donnees
  OK   B voit l’archivage fait sur A (LE SYMPTÔME D’ORIGINE)
  OK   G2 : un navigateur neuf n’écrase pas la vérité avec ses données de démo
  OK   aucun allumage de prise pendant tout l’essai — aucune commande

---
Réussies : 13 | Échouées : 0 | Total : 13
VERDICT : SUCCÈS
=== APRES D8+D9 : essai-file-local ===
  OK   aucune erreur JavaScript en file://
    [file://] {"local":true,"lots":5,"recettes":6,"appareils":9,"titre":"Vue d’ensemble","vide":24219,"bandeau":true,"partage":false,"proposePartage":false}
  OK   la page se sait en mode local (PONT_LOCAL)
  OK   la vue est rendue (pas de page blanche) — 24219 caractères
  OK   le jeu de démonstration est présent — 6 recettes, 9 appareils
  OK   la page ne prétend PAS que ses données sont partagées
  OK   aucun bouton de partage proposé sans pont
  OK   le bouton Exporter reste atteignable hors ligne
  OK   aucun appel réseau vers une API
  OK   la fiche d’un lot s’ouvre en file:// — Miso d’orge 2026
  OK   la vue Appareils liste le parc — 9 entrées
  OK   aucun « undefined » affiché à l’écran
  OK   toujours aucune erreur JavaScript après navigation

---
Réussies : 12 | Échouées : 0 | Total : 12
VERDICT : SUCCÈS
=== APRES D8+D9 : verif-d7 ===
  OK   terminer un lot (archivage) — vivant true -> undefined, écrit undefined
  OK   rattacher un appareil à un lot — vivant true -> undefined, écrit undefined
  OK   changer le mode d’un appareil — vivant true -> undefined, écrit undefined
  OK   ajouter une note au journal — vivant true -> undefined, écrit undefined
  OK   ajouter un relevé de densité — vivant true -> undefined, écrit undefined

---
Réussies : 5 | Échouées : 0 | Total : 5
VERDICT : SUCCÈS
```

Le `404` apparu dans la seconde exécution est l'icône `favicon.ico` que le serveur d'essai ne
sert pas ; il est présent ou absent selon le moment où Edge la demande, et il ne porte sur aucune
assertion.

### 3.3 Sonde dédiée D8 / D9

Les trois batteries ci-dessus prouvent la **non-régression**, pas la correction : aucune d'elles
ne sature le quota ni n'ouvre un dialogue avant la première lecture. J'ai donc ajouté un
**nouveau** fichier de mesure, `scada-opus-5.5/_verify/_sonde-d8-d9.mjs` (voir §6 sur la ligne
rouge « ne touche à aucun autre fichier » : aucun essai existant n'est modifié).

Elle ne simule pas la panne, elle la provoque : `localStorage` est réellement saturé par paliers
décroissants (64 ko, 4 ko, 256 o, 16 o) jusqu'à ce qu'il ne reste pas la place d'une écriture de
quelques kilo-octets, et la précondition est mesurée **avec la fonction de la page elle-même** —
`sauvegarderLocal('sonde-precondition-')` doit renvoyer `null`, sinon toute la suite serait un
mensonge.

**Première exécution : la sonde s'est trompée, et l'a montré.** Je saturais le quota 1,5 s après
le chargement — or la synchronisation arrive en moins d'une seconde, donc B avait déjà adopté
(`lotAdopte: true`, `motif: null`) et la mesure ne mesurait rien :

```
    [quota B] {"blocs":106,"sauvegardeLocalePossible":false,"essai":"null"}
  OK   précondition : sauvegarderLocal() échoue vraiment dans B — 106 blocs écrits, retour null
    [etat B] {"motif":null,"pontRev":1,"lotAdopte":true,"recetteAdoptee":true,"demoEncoreLa":false,...}
  KO   D8/auto : la divergence porte le motif sauvegardeImpossible — motif = null
```

C'était un défaut de la sonde, pas du correctif : le quota était saturé **après** l'adoption.
Corrigé en coupant `/api/donnees*` en 503 pendant la préparation (une « vanne » dans le relais du
serveur d'essai), puis en vérifiant explicitement, avant de rouvrir, que B n'a encore rien adopté.
Je le consigne au lieu de l'effacer : c'est l'avertissement du brief — mesurer, pas deviner.

**Deuxième exécution : la sonde s'est trompée une deuxième fois, autrement.** Mon marqueur
était le lot `b1` — or le jeu de démonstration contient déjà `b1` (« Saison du Nord #3 »), donc
`S.batches.some(b => b.id === 'b1')` était vrai dès le chargement et « le document a été
adopté » était faux. Marqueurs remplacés par des identifiants uniques (`sonde-lot`,
recette `Test eau sonde`).

Cette exécution a aussi révélé un **vrai comportement du code**, qui n'est pas un défaut mais
qu'il faut connaître (§4).

### 3.4 Un effet découvert en mesurant : saturer le quota fait tomber la marque « démo »

Sur la branche de **première lecture**, saturer le quota ne mène pas au refus de G3, et la
raison est intéressante :

1. `save()` échoue (quota plein) et appelle `alerteStockage()`, qui fait un
   `logEvent('alert', …)` ;
2. `logEvent` allonge `S.events` ;
3. `empreinteDemo(e)` inclut `j: (e.events || []).length` — la longueur du journal ;
4. l'empreinte diverge donc de `empreinteSemence()`, et `save()` exécute
   `delete S.ensemence` ;
5. `etatEnsemence()` devient faux, et la branche de première lecture ne tente **plus
   d'adoption automatique du tout** : elle prend la route ordinaire `divergence`.

Autrement dit : sur cette branche, un quota saturé se protège par un autre chemin que celui que
je viens d'écrire. L'exigence est néanmoins respectée — rien n'est adopté, et l'utilisateur voit
un bandeau. Je ne l'ai pas « corrigé » : ce serait toucher à la marque de démonstration (ligne
rouge n° 6) et au mécanisme de D7, qu'on vient de stabiliser au prix de deux régressions.

**Conséquence pour la mesure** : la démonstration de D8 porte sur le **chemin automatique B**
(« un autre appareil a écrit »), qui est de toute façon le cas réel du défaut — je suis à jour,
je n'ai rien de local à perdre, l'adoption serait « sans risque », et c'est précisément là que
l'ancien code adoptait sans filet. Le chemin A est mesuré aussi, sur l'exigence qui compte
(rien d'adopté).

### 3.5 Deux autres choses que la mesure a appris, et qui ne sont PAS des défauts

**(a) Le bandeau de partage n'existe que sur la vue d'ensemble.** `bandeauPartage()` n'est
appelée qu'une seule fois dans tout le fichier, depuis `home()`. Un utilisateur resté sur
*Appareils* ou *Recettes* ne voit donc aucun bandeau — ni le mien, ni `degrade`, ni `perdu`, ni
`vierge`, ni `divergence`. C'est l'état antérieur à cette correction, identique pour les cinq
états. Je ne l'ai pas changé : la demande était « suis le modèle des états existants », et
déplacer le bandeau hors de `home()` toucherait la mise en page de toutes les vues, très loin du
périmètre demandé. **Je le signale parce que c'est un vrai angle mort** : un refus d'adoption
reste invisible tant que l'utilisateur n'est pas sur l'accueil. À arbitrer séparément.

**(b) `ensemence` tombe d'elle-même en quelques secondes dès que le journal bouge.** Même
mécanisme qu'en §3.4, sans quota saturé : tout `logEvent` change `(e.events||[]).length`, donc
l'empreinte, donc `save()` retire la marque. L'adoption automatique de première lecture n'a donc
qu'une fenêtre courte après le chargement — celle qu'`essai-deux-appareils` exerce (« B reçoit le
lot sans rien saisir », vert). Mesuré : à la préparation du contexte E, `ensemence` valait encore
`true` mais `empreinteDemo(S) === empreinteSemence()` était **déjà faux** avec 28 entrées de
journal — la marque n'était donc plus qu'en sursis, et le `save()` suivant l'a retirée.

Ma sonde, qui doit retarder la première lecture pour ouvrir un dialogue avant, sort de cette
fenêtre. Deux conséquences, traitées différemment :

- **Contexte C** (dialogue ouvert par `add-dev`, un geste d'édition qui fait tomber la marque
  volontairement) : après fermeture, la page pose une `divergence` affichée au lieu d'adopter.
  C'est correct — le navigateur a été touché — et l'assertion porte donc sur ce que §6 exige
  réellement : *la synchronisation reprend et la page tranche*.
- **Contexte E** (dialogue ouvert sans geste d'édition) : la marque est épinglée par la sonde
  (§4) pour tenir la précondition, et l'assertion peut alors être la forte — *après fermeture,
  l'adoption se fait*. Elle est verte.

### 3.6 Sonde D8 / D9 sur la page corrigée — sortie réelle, 28/28

```
################ A) PAGE CORRIGEE ################
Page sous mesure : C:\Users\Timothée\Documents\IA\Hermes\MyFermentLab\scada-opus-5.5\hakko-dashboard.html

  OK   préparation : le pont détient un document de référence — rev 1

  D8 — un autre appareil a écrit, quota saturé (chemin automatique B)
  OK   préparation B : B est à jour et n’a rien de local à perdre — {"rev":1,"sigEcrite":true,"recette":true}
    [quota B] {"blocs":109,"sauvegardeLocalePossible":false,"essai":"null"}
  OK   précondition : sauvegarderLocal() échoue vraiment dans B — 109 blocs écrits, retour null
    [ecriture autre appareil] {"status":200,"rev":2}
  OK   préparation : un autre appareil a écrit une révision plus récente — rev 1 -> 2
    [etat B] {"motif":"sauvegardeImpossible","pontRev":1,"recetteAutreAppareil":false,"recetteRef":true,"bandeau":"Le stockage de ce navigateur est plein : la copie de sauvegarde exigée avant toute adoption n'a pas pu être écrite. Les données du pont (révision 2) n'ont donc pas été adoptées — les vôtres sont intac","aExport":true,"aAdopter":true,"aGarder":true}
  OK   D8/auto : la divergence porte le motif sauvegardeImpossible — motif = sauvegardeImpossible
  OK   D8/auto : le document du pont n’a PAS été adopté — recette de l’autre appareil présente : false
  OK   D8/auto : les données locales de B sont intactes
  OK   D8/auto : PONT.rev n’est PAS avancé (la page ne se croit pas à jour) — PONT.rev = 1, pont = 2
  OK   D8/auto : le bandeau AFFICHE l’état (stockage plein, rien adopté)
  OK   D8/auto : le bandeau porte ses sorties nommées (exporter, adopter, garder) — export true, adopter true, garder true
    [dialogues vus] ["alert : Le stockage de ce navigateur est plein : aucune copie de sauvegarde ne peut y être écrite. Exportez d’abord vos données "]
  OK   D8/manuel : sans export, un alert() exige l’export (pas de confirm trompeur) — alert
  OK   D8/manuel : rien n’est adopté avant l’export — {"adopte":false,"motif":"sauvegardeImpossible","exportT":0}
    [dialogue apres export] ["confirm : Remplacer les données de cet appareil par celles du pont ? ATTENTION : le stockage de ce navigateur est plein. AUCUNE copie de sauvegarde ne sera conservée ici — votre version ne survivra que dans le fichier exporté le 4"]
  OK   D8/manuel : le confirm() ne promet PAS « votre version est conservée » — Remplacer les données de cet appareil par celles du pont ? ATTENTION : le stockage de ce n
  OK   D8/manuel : après export, l’adoption forcée aboutit (pas d’impasse) — {"adopte":true,"motif":null}

  D8 — première lecture, quota saturé (chemin automatique A)
    [quota D] {"blocs":101,"sauvegardeLocalePossible":false,"essai":"null"}
    [avant reouverture D] {"rev":null,"recette":false,"ensemence":true}
  OK   précondition D : quota saturé et rien encore adopté — {"rev":null,"recette":false,"ensemence":true}
    [etat D] {"motif":null,"actif":true,"disponible":true,"jetonRequis":false,"partage":false,"pontRev":null,"adopte":false,"demoEncoreLa":true,"bandeau":"Hors ligne — vos modifications restent sur cet appareil et ne sont pas partagées. Exporter mes données","aExport":true,"aAdopter":false}
  OK   D8/première lecture : RIEN n’est adopté quand la sauvegarde est impossible — {"adopte":false,"demo":true,"motif":null}
  OK   D8/première lecture : l’export reste atteignable dans tous les cas — bandeau : Hors ligne — vos modifications restent sur cet appareil et ne sont pas

  D9 — aucune adoption pendant une saisie, branche PREMIÈRE lecture
  OK   préparation C : vanne fermée, PONT.rev est encore null — {"rev":null,"lot":false}
  OK   préparation C : un dialogue de saisie est ouvert — {"ok":true}
    [C pendant la saisie] {"dlgOuvert":true,"pontRev":null,"adopte":false,"demoEncoreLa":true}
  OK   C : le dialogue est resté ouvert pendant la mesure
  OK   D9 : RIEN n’est adopté pendant la saisie, première lecture comprise — {"dlgOuvert":true,"pontRev":null,"adopte":false,"demoEncoreLa":true}
    [C apres fermeture] {"pontRev":2,"adopte":false,"motif":"divergence","aAdopter":true,"aExport":true}
  OK   D9 : une fois la saisie finie, la synchronisation reprend et la page tranche — {"pontRev":2,"adopte":false,"motif":"divergence","aAdopter":true,"aExport":true}
  OK   D9 : C ayant été édité (add-dev), la reprise pose une divergence affichée, pas une adoption muette — {"motif":"divergence","adopter":true}

  D9 — dialogue ouvert sans geste d’édition (la marque démo survit)
    [preparation E] {"ok":true,"rev":null,"ensemence":true,"nEv":28,"empreinteEgale":false,"adopte":false}
  OK   préparation E : dialogue ouvert, marque démo intacte, rien encore adopté — {"ok":true,"rev":null,"ensemence":true,"nEv":28,"empreinteEgale":false,"adopte":false}
    [E pendant la saisie] {"dlgOuvert":true,"pontRev":null,"ensemence":true,"nEv":28,"empreinteEgale":false,"adopte":false,"demoEncoreLa":true}
  OK   D9 : rien n’est adopté pendant la saisie, marque démo tenue (LA branche qui adoptait) — {"dlgOuvert":true,"pontRev":null,"ensemence":true,"nEv":28,"empreinteEgale":false,"adopte":false,"demoEncoreLa":true}
    [E apres fermeture] {"pontRev":2,"adopte":true,"demoEncoreLa":false,"ensemence":true,"nEv":29,"motif":null}
  OK   D9 : la saisie finie, l’adoption se fait bien (le gel est une pause, pas une panne) — {"pontRev":2,"adopte":true,"demoEncoreLa":false,"ensemence":true,"nEv":29,"motif":null}
  OK   aucune erreur JavaScript dans les navigateurs de la sonde
  OK   aucun allumage de prise pendant toute la sonde — aucune commande

---
Réussies : 28 | Échouées : 0 | Total : 28
VERDICT : SUCCÈS
```

Les deux lignes qui portent le plus :

- `PONT.rev = 1, pont = 2` — la page a **refusé** d'adopter et n'a pas avancé sa révision. Elle
  ne se croit pas à jour, donc le bandeau ne disparaîtra pas au tour suivant.
- `[E pendant la saisie] … "adopte":false` puis `[E apres fermeture] … "adopte":true` — le gel
  pendant la saisie est bien une **pause** : dès que le dialogue se ferme, l'adoption se fait.

## 4. Contrôle négatif

Deux copies de la page, dans `scada-opus-5.5/_verify/neg-d8-d9/`, chacune avec **une** des deux
corrections réintroduite à l'envers. La page de production n'est jamais modifiée : la sonde prend
le chemin de la page en argument (`node _sonde-d8-d9.mjs <chemin>`), et les copies sont
regénérées depuis la page corrigée par un script qui compte les accolades, pas par une réécriture
à la main.

- `neg-d8.html` — le bloc de refus de `adopterDocument` est retiré : la fonction appelle
  `sauvegarderLocal`, ignore son échec et adopte quoi qu'il arrive. C'est exactement le défaut
  D8 d'origine.
- `neg-d9.html` — la garde `if (dlg && dlg.open)` est retirée de la tête de
  `pontSynchroDonnees` et remise dans la seule branche « un autre appareil a écrit », avec son
  `return` nu. C'est exactement le défaut D9 d'origine.

Les deux copies passent le contrôle de syntaxe, et `diff` confirme que chacune ne diffère de la
page corrigée que par la correction retirée :

```
=== neg-d8 vs page corrigee, le seul ecart ===
1913,1923d1912
<   if (!avant && !forcee){
<     /* Le refus est réévalué à chaque synchronisation, toutes les trois secondes, tant que
<        le stockage reste plein : l'écrire chaque fois remplirait le journal et en chasserait
<        les vraies commandes — même raison, même cadence que `alerteStockage`. L'état, lui,
<        reste visible en permanence dans le bandeau ; c'est son rôle. */
<     if (!PONT.refusT || now() - PONT.refusT > 10 * 60e3){
<       PONT.refusT = now();
<       logEvent('alert', 'Adoption refusée : le stockage de ce navigateur est plein, la copie de sauvegarde exigée avant toute adoption n’a pas pu être écrite. Vos données sont intactes — exportez-les, puis adoptez.');
<     }
<     return false;
<   }

=== neg-d9 vs page corrigee, le seul ecart ===
2014,2015d2013
<   const dlg = document.getElementById('dlg');
<   if (dlg && dlg.open) return fin();
2076a2075,2076
>     const dlg = document.getElementById('dlg');
>     if (dlg && dlg.open) return;
```

### Tenir la précondition de D9, et pourquoi il a fallu le faire

Le contrôle négatif de D9 ne peut rougir que si la branche de première lecture **tente**
réellement d'adopter, ce qu'elle ne fait que si `etatEnsemence()` est vrai. Or la marque tombe
d'elle-même en moins de 2,5 s (§3.5b), bien avant qu'on ait pu ouvrir un dialogue. La sonde
épingle donc la marque sur le contexte E, en posant sur `S` une propriété `ensemence` **non
configurable** dont l'accesseur renvoie toujours `true`.

Première tentative, un `setInterval` toutes les 100 ms : **perdue par course**, et la mesure l'a
montré (assertion rouge sur la page corrigée, `ensemence: true` mais `motif: 'divergence'`).
`save()` est appelée juste avant la synchronisation des données et y fait `delete S.ensemence` :
`etatEnsemence()` était donc lu systématiquement dans la fenêtre où la marque venait de tomber.
La propriété non configurable résiste au `delete` (hors mode strict, il échoue en silence) et
tient la précondition de bout en bout. Je ne touche pas au code mesuré : je maintiens l'état
« navigateur de démonstration jamais touché », qui est exactement celui pour lequel cette
branche est écrite — et dont `essai-deux-appareils` prouve qu'il existe en vrai.

### 4.1 Contrôle négatif D8 — la mesure passe au rouge

`node _sonde-d8-d9.mjs neg-d8-d9/neg-d8.html` — **20 réussies, 8 échouées**, là où la page
corrigée donne 28/28. Les assertions qui rougissent, et ce qu'elles disent :

```
  KO   D8/auto : la divergence porte le motif sauvegardeImpossible — motif = null
  KO   D8/auto : le document du pont n’a PAS été adopté — recette de l’autre appareil présente : true
  KO   D8/auto : PONT.rev n’est PAS avancé (la page ne se croit pas à jour) — PONT.rev = 2, pont = 2
  KO   D8/auto : le bandeau AFFICHE l’état (stockage plein, rien adopté)
  KO   D8/auto : le bandeau porte ses sorties nommées (exporter, adopter, garder) — export false, adopter false, garder false
  KO   D8/manuel : sans export, un alert() exige l’export (pas de confirm trompeur) — aucun dialogue
  KO   D8/manuel : rien n’est adopté avant l’export — {"adopte":true,"motif":null,"exportT":0}
  KO   D8/manuel : le confirm() ne promet PAS « votre version est conservée »
Réussies : 20 | Échouées : 8 | Total : 28
VERDICT : ÉCHEC — 8 assertion(s)
```

C'est D8 reproduit, dans un vrai navigateur au quota réellement saturé :
`recette de l'autre appareil présente : true` — **le document du pont a été adopté alors
qu'aucune copie de sauvegarde n'a pu être écrite**, et `PONT.rev = 2` — la page s'est déclarée
à jour. Aucun bandeau, aucune sortie : la perte est silencieuse. C'est exactement ce que la
revue décrivait.

### 4.2 Le contrôle négatif D9 a d'abord été VERT — et c'est lui qui a trouvé la vraie erreur

Première exécution du contrôle négatif D9 : **28/28, SUCCÈS.** Retirer la correction ne changeait
rien. Un contrôle négatif qui reste vert ne valide pas la correction : il invalide la mesure.

Cause, trouvée en lisant la boucle au lieu de supposer (`hakko-dashboard.html`, dernière ligne) :

```js
setInterval(() => { tick(); save(); refreshLive(); if (++ticPont % 5 === 0) pontSynchro(true); }, 3000);
```

`pontSynchro` — et donc `pontSynchroDonnees` — n'est appelée **qu'un tour sur cinq, soit toutes
les 15 secondes**, pas toutes les 3 secondes. Ma sonde attendait 11 s avec le dialogue ouvert :
cette fenêtre **ne contenait aucune synchronisation**. « Rien n'est adopté » était donc vrai pour
une raison qui n'avait rien à voir avec la garde, dans les deux versions. La mesure était vide,
et c'est précisément le piège que le brief décrivait.

Deux conséquences, les deux appliquées :

1. **La sonde ne compte plus le temps, elle compte les synchronisations.** Le serveur d'essai
   compte les `GET /api/donnees/rev` (une synchronisation a eu lieu) et les `GET /api/donnees`
   (le document a été téléchargé). Chaque fenêtre « dialogue ouvert » attend désormais que
   **deux lectures de révision** aient réellement eu lieu — assertion explicite, verte ou rouge,
   plus aucun délai en dur — puis vérifie que **le document n'a même pas été téléchargé** : la
   garde doit arrêter la page avant le `GET /api/donnees`. C'est une assertion beaucoup plus
   dure que « rien n'est adopté », et elle ne peut pas être vraie par accident.
2. **Un commentaire que j'avais écrit dans la page était faux** et je l'ai corrigé : j'avais
   écrit que le refus de G3 est réévalué « toutes les trois secondes ». C'est toutes les 15 s.
   La borne de dix minutes sur l'alerte reste justifiée (40 alertes identiques par dix minutes
   sans elle), mais le commentaire devait dire vrai.

Les quatre attentes de 20 s de la sonde sont aussi passées à 60 s : avec un cycle de 15 s à phase
quelconque, 20 s pouvait manquer la synchronisation attendue — une autre source de verdict
aléatoire.

### 4.3 Contrôle négatif D9, mesure refaite

(exécution en cours)

## 5. Ce que je n'ai PAS pu vérifier

1. **Une adoption forcée ne peut pas être persistée.** Quand l'utilisateur force l'adoption
   après export (stockage plein), `adopterDocument` applique le document en mémoire mais le
   `save()` final échoue — forcément, le quota est saturé. L'écran montre donc les données du
   pont, et un rechargement ramènera l'état précédent. La page le dit déjà par ailleurs
   (`alerteStockage` : « État non sauvegardé : le stockage du navigateur est plein »), et c'est
   le moins mauvais comportement (rien n'est perdu), mais **je n'ai pas vérifié ce
   rechargement** : la sonde mesure l'adoption en mémoire, pas sa survie à un `reload`. Libérer
   de la place reste le seul vrai remède, et aucune ligne de la page ne peut le faire à la place
   de l'utilisateur.
2. **Le vrai bouton d'export n'est pas cliqué par la sonde.** Un `click()` sur un lien
   `download` ouvre une boîte de téléchargement qui bloque le navigateur sans tête. La sonde
   pose donc `PONT.exportT` directement pour franchir la porte. Ce qui est mesuré par un vrai
   clic, c'est la **présence** du bouton `data-action="exporter"` dans le bandeau (assertion
   verte dans `essai-deux-appareils` et dans la sonde) ; la ligne `PONT.exportT = now()` ajoutée
   dans le gestionnaire `exporter` n'est, elle, vérifiée que par relecture.
3. **Aucune prise réelle n'a été commandée, et ce n'était pas le sujet.** Tous les essais
   tournent contre un faux Home Assistant. Les trois batteries et la sonde vérifient toutes
   qu'aucun `turn_on` n'a été émis ; aucune ne valide le comportement sur du matériel.
4. **Le mode dégradé et G1 avec un quota saturé** ne sont pas mesurés : ces deux branches
   n'adoptent rien par construction, et ma modification ne les traverse pas. Les essais
   dédiés existants (`verif-d3-degrade.py`, `verif-d2-d4-autorite.py`) n'étaient pas dans la
   liste des trois batteries à faire passer et je ne les ai pas lancés.
5. **Un vrai navigateur de téléphone** (Safari iOS, où l'éviction de `localStorage` est le
   scénario d'origine de G2) : les essais tournent sous Edge headless uniquement.

## 6. Lignes rouges : ce que j'ai frôlé, et pourquoi

| Ligne rouge | État | Détail |
|---|---|---|
| 1. Aucune dépendance nouvelle | **respectée** | Rien d'ajouté. Du JavaScript nu dans le même fichier HTML, aucune compilation. |
| 2. Ne pas toucher aux freins de régulation | **respectée** | Vérifié mécaniquement : aucune ligne ajoutée ou retirée de mon diff ne contient `AUTO_*`, `regulerPont`, `regulerSecurite`, `regulMaitre`, `PONT.regule` ni `function tick`. |
| 3. Ne toucher à aucun autre fichier | **frôlée — à lire** | Voir ci-dessous. |
| 4. CRLF partout | **respectée** | Avant : 3251 lignes / 3251 CRLF. Après : 3336 lignes / 3336 CRLF, **0 ligne en LF seul**. |
| 5. Fonctionne en `file://` | **respectée** | `essai-file-local` : 12/12. La garde D9 lit `document.getElementById('dlg')`, sans réseau ; et `pontSynchroDonnees` sort de toute façon dès `PONT_LOCAL`. |
| 6. Ne retirer aucune marque `demo` ni `ensemence` | **respectée** | Comptage identique avant/après (`demo` : 21 lignes, `ensemence` : 13 lignes). Aucune des deux n'apparaît dans mon diff. |
| 7. Aucun allumage de prise | **respectée** | Aucune ligne ajoutée ne contient `turn_on`, `services/switch`, `.on = true` ni équivalent ; et les quatre jeux de mesures assertent « aucun allumage ». |

### Ligne rouge n° 3 — ce que j'ai créé, et ce que je n'ai pas touché

**Aucun fichier existant n'a été modifié en dehors de `scada-opus-5.5/hakko-dashboard.html`.**
Vérifié : mon diff isolé (contre `design/page-avant-d8-d9.html`, la copie prise avant D8/D9)
tient en 9 fragments, tous dans les fonctions visées. Les modifications de `pont/pont.py`,
`nginx.conf`, `k8s/deployment.yaml` et `_verify/essai-deux-appareils.mjs` que montre
`git status` **précèdent cette session** : elles étaient déjà là dans l'état de départ fourni, je
ne les ai pas touchées.

J'ai en revanche **créé** trois choses, parce que le livrable demande un contrôle négatif et
qu'il est impossible de mesurer sans instrument :

- `scada-opus-5.5/_verify/_sonde-d8-d9.mjs` — la sonde. Nouveau fichier ; aucun essai existant
  n'est modifié. Le préfixe `_` suit la convention des autres sondes du répertoire
  (`_sonde-empreinte.mjs`, `_probe.mjs`, `_mesure-*.mjs`).
- `scada-opus-5.5/_verify/neg-d8-d9/neg-d8.html` et `neg-d9.html` — les deux copies du contrôle
  négatif. Ce sont des copies jetables, pas du code servi.
- `design/revue-d8-d9.md` — ce rapport (demandé).

Si cette création est elle-même en dehors du périmètre, les trois se suppriment sans effet :
rien dans la page ni dans les trois batteries n'y fait référence.

### Un point que je n'ai PAS changé, et qui mériterait un arbitrage

Le bandeau de partage n'est rendu que par `home()` (§3.5a). Mon nouvel état hérite donc de la
même limite que les quatre autres : **un refus d'adoption reste invisible tant que
l'utilisateur n'est pas sur la vue d'ensemble.** Le corriger demanderait de sortir
`bandeauPartage()` de `home()` et de le placer dans `render()`, ce qui touche la mise en page de
toutes les vues — hors du périmètre demandé, et contraire à la consigne « suis le modèle des
états existants ». Je le laisse tel quel et je le signale ici plutôt que de le décider seul.

