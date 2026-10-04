# Protocole — données partagées et plan déduit côté pont

Statut : proposition de l'assistant, **à arbitrer**. Contrat d'implémentation une fois accepté.
Date : 2026-10-03. Fichiers concernés : `scada-opus-5.5/pont/pont.py`,
`scada-opus-5.5/hakko-dashboard.html`, `scada-opus-5.5/k8s/deployment.yaml`.

## 1. Le problème, mesuré

Les recettes, lots, appareils et le journal vivent dans le `localStorage` du navigateur
(clé `hakko-dashboard-v2`, seule source : `localStorage.getItem/setItem` dans la page).
Le pont ne reçoit qu'un *plan de régulation* déposé par une page (`POST /api/regul`).

Conséquence constatée : le PC supprime une recette, le téléphone l'affiche encore. Pire, le
téléphone qui ouvre le dashboard dépose **son** plan, contenant la recette supprimée — et le
pont chauffe pour un lot que le PC croit effacé. Le pont n'a rien fait de mal : la vérité est
en double.

## 2. Décision d'architecture (à arbitrer)

**A. Une seule vérité, côté pont.** Le pont conserve un document JSON opaque — recettes, lots,
appareils, journal, réglages — dans `/data/donnees.json`, sur le volume persistant qui existe
déjà (`scada-opus-pont-etat`, 8 Mi, monté sur `/data`). Il ne l'interprète pas : il le stocke.

**B. Le plan n'est plus déposé, il est DÉDUIT.** Le pont calcule lui-même le plan de régulation
à partir des lots du document partagé. La page cesse d'appeler `POST /api/regul`. C'est ce qui
supprime la classe de défaut entière : un appareil périmé ne peut plus imposer ses lots, puisque
plus personne ne dépose de plan. Sa responsabilité devient : lire, éditer, écrire le document.

## 3. Endpoints (contrat)

Tous sous les mêmes gardes que l'existant : `Content-Type: application/json` exigé sur POST
(sinon 415), corps invalide → 400, hors liste blanche → 403, taille maximale **2 Mio** → 413.

### `GET /api/donnees`
```json
{ "ok": true, "rev": 7, "maj": 1790962048, "donnees": { ... } }
```
Document jamais écrit : `{ "ok": true, "rev": 0, "maj": 0, "donnees": null }`.

### `POST /api/donnees`
Corps : `{ "base": <rev lue par le client>, "donnees": <objet> }`.
- `base == rev` du pont → écriture **atomique** (fichier temporaire puis `os.replace`), `rev`
  incrémenté, réponse `{ "ok": true, "rev": <nouveau> }`.
- `base != rev` → **409** avec le document courant : `{ "ok": false, "motif": "revision",
  "rev": <courant>, "donnees": <courant> }`. Le client **n'écrase jamais** : il adopte ou
  demande à son utilisateur.
- `base` absent ou non entier → 400.

### Ce qui disparaît
`POST /api/regul` : supprimé du pont, supprimé des appels de la page. `GET /api/regul` reste
(lecture seule, diagnostic) et renvoie le plan **déduit**, avec sa provenance.

## 4. Déduction du plan (pont)

À chaque tour (20 s), le pont relit le document partagé et en tire le plan :
- un **lot** de `donnees.batches` avec `status === "active"` devient un plan actif ;
- sa **consigne** et son **écart** viennent de sa recette (`donnees.recipes`) ;
- sa **sonde** et ses **prises** viennent des appareils qui lui sont rattachés
  (`donnees.devices`, champ d'appartenance au lot), filtrés sur `eid` réel et sans marque de
  démonstration ;
- liste blanche (`PONT_PRISES` / `PONT_SONDES`) : un plan qui citerait une entité hors liste est
  refusé **en entier**, comme aujourd'hui.
Le document est relu au plus une fois par tour ; en cas d'illisibilité, **on conserve le plan
précédent** et on l'écrit au journal (ne jamais couper une chauffe parce que le fichier est
temporairement illisible).

## 5. Migration — c'est là que le risque de perte est le plus grand

Le pont démarre sans document (`rev: 0`). Le **premier appareil** qui ouvre le dashboard propose
de faire de **ses** données la référence partagée : confirmation explicite de l'utilisateur,
copie de sauvegarde locale conservée sous une clé distincte (`hakko-dashboard-v2-sauvegarde`),
puis `POST` avec `base: 0`. Le second appareil, voyant `rev > 0`, **ne pousse pas** : il compare,
annonce « les données partagées remplacent les vôtres » (avec un bouton pour exporter les siennes
avant), et adopte. Aucun écrasement silencieux, dans aucun sens.

## 6. Repli

Pont injoignable, ou page ouverte en `file://` : la page retombe sur `localStorage` et le dit à
l'écran (« hors ligne — vos modifications ne sont pas partagées »). Au retour du pont, les deux
documents sont comparés par révision ; en cas de divergence, **on ne fusionne pas** : on avertit
et on laisse choisir.

## 7. Invariants à ne pas casser

1. **Aucune dépendance nouvelle** (ponytail) : bibliothèque standard seulement, un fichier JSON.
2. La page doit **continuer de fonctionner ouverte en `file://`**, sans pont.
3. Le code de sûreté de la régulation est **inchangé** : liste blanche, frein d'une commande par
   minute, plafond de 90 min, coupure sur sonde muette (15 min), coupure sur mesure figée (1 h),
   balayage des prises non réclamées. Une passe qui y touche est refusée.
4. La page servie reste **l'octet pour octet** du fichier local (après normalisation LF).
5. Monorepo GitOps : la page et le pont sont **deux images distinctes** ; ne pas croiser les
   responsabilités.

## 8. Définition de « fini »

- Tests unitaires du pont sur le protocole (révision, 409, taille, illisibilité, migration).
- Preuve par exécution à deux navigateurs : A écrit, B voit ; B écrit sur une révision périmée →
  409 → B adopte sans écraser ; pont coupé → la page fonctionne et le dit.
- Preuve que le plan est **déduit** : un lot rendu actif dans le document partagé chauffe **sans
  qu'aucune page ne soit ouverte**, et un lot archivé coupe.

## 9. Ce que je ne tranche pas seul (questions à l'arbitre)

1. Le document est-il un objet **opaque** unique, ou faut-il des clés séparées (`recettes`, `lots`,
   `appareils`, `journal`) que le pont valide une à une ? Le journal peut être volumineux :
   faut-il le sortir du document partagé ?
2. **Qui gagne** si deux appareils écrivent à quelques secondes d'intervalle — 409 strict (le
   second perd son travail et doit réappliquer) ou fusion par lot ? Le 409 strict est simple ;
   est-il assez sûr pour un usage à deux appareils ?
3. Le pont doit-il **refuser d'écrire** un document qui casserait la régulation (lot actif sans
   sonde, prise hors liste) — au risque de bloquer l'utilisateur — ou l'accepter et le signaler ?
4. La page doit-elle cesser complètement d'écrire son plan, ou garder `POST /api/regul` comme
   chemin de secours quand le document est illisible ?
5. Faut-il un horodatage par lot (dernière modification) plutôt qu'une révision globale, pour
   qu'un conflit n'invalide que ce qui a réellement changé ?
