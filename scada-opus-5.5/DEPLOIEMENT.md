# Déploiement GitOps — Scada-opus-5.5

Le dashboard est déployé sur le cluster k3s du homelab par ArgoCD, selon une chaîne
entièrement automatique :

```
        ┌────────────────────────────────────────────────────────────────┐
        │  modif locale dans scada-opus-5.5/                             │
        └───────────────────────────────┬────────────────────────────────┘
                                        │  git push (branche Scada-opus-5.5)
                                        ▼
        ┌────────────────────────────────────────────────────────────────┐
        │  GitHub Actions  (.github/workflows/build-scada-opus.yml)       │
        │   1. build de l'image nginx + fichiers statiques                │
        │   2. push sur ghcr.io/timbenedet/myfermentlab-scada             │
        │      tags : scada-opus-<sha court>  et  latest                  │
        │   3. réécrit le tag dans scada-opus-5.5/k8s/kustomization.yaml  │
        │      et commite « chore(scada): déploie l'image … [skip ci] »   │
        └───────────────────────────────┬────────────────────────────────┘
                                        │  nouveau commit sur la branche
                                        ▼
        ┌────────────────────────────────────────────────────────────────┐
        │  ArgoCD  (application `scada-opus-5.5`, namespace argocd)       │
        │   surveille la branche, détecte le commit, applique le dossier  │
        │   scada-opus-5.5/k8s  →  rolling update du Deployment           │
        └────────────────────────────────────────────────────────────────┘
```

## Accès

| Chemin | URL |
|---|---|
| Accès direct par IP (garanti, sans DNS) | http://192.168.1.51:30090/ |
| Ingress Traefik (si `hakko.myfermentlab` résout) | http://hakko.myfermentlab/ |
| Dashboard directement | http://192.168.1.51:30090/hakko-dashboard.html |

`scada.myfermentlab` était déjà pris par `manifests/ingress.yaml` (application
scada-redesign) : l'hôte retenu ici est **`hakko.myfermentlab`**.

## Ce que contient `k8s/`

| Fichier | Rôle |
|---|---|
| `namespace.yaml` | namespace `scada-opus` (isolé du `default` et de `manga`) |
| `deployment.yaml` | 2 réplicas nginx (sondes `/healthz`, rolling update sans coupure) + le conteneur `pont` (sidecar, voir plus bas) |
| `service.yaml` | NodePort **30090** (30080/30081 = manga, 30087 = fermentation-v3) |
| `ingress.yaml` | Traefik, hôte `hakko.myfermentlab` |
| `kustomization.yaml` | la référence appliquée par Argo ; **le tag d'image y est écrit par la CI** |

## Modifier le site et le voir en ligne

```bash
# 1. éditer par exemple scada-opus-5.5/hakko-dashboard.html
git add scada-opus-5.5/ && git commit -m "…"
git pull --rebase && git push      # la CI commite aussi sur cette branche : rebaser avant de pousser
# 2. suivre la chaîne :
#    - l'image se construit :  https://github.com/TimBenedet/MyFermentLab/actions
#    - le tag est mis à jour : le commit « chore(scada): déploie l'image … »
#    - ArgoCD synchronise :    kubectl -n argocd get app scada-opus-5.5 -w
kubectl -n scada-opus get pods -w
```

ArgoCD *poll* le dépôt toutes les 3 minutes environ : compter jusqu'à 3 minutes entre
le commit de mise à jour du tag et le déploiement (immédiat si on clique sur *Refresh*
dans l'interface ArgoCD, ou via `kubectl -n argocd annotate app scada-opus-5.5 argocd.argoproj.io/refresh=hard --overwrite`).

## Le pont Home Assistant — les boutons pilotent vraiment les prises

La page « Appareils » commande les 5 prises de la multiprise pilotée par Home Assistant. Un
navigateur ne peut pas appeler l'API de Home Assistant directement : elle n'envoie **aucun**
en-tête CORS (mesuré), et le jeton ne doit pas se retrouver dans la page — quiconque l'ouvre
pourrait alors piloter la maison. Le pont résout les deux :

```
   navigateur ──HTTP──► nginx (pod scada-opus) ──/api/──► pont Python ──jeton──► Home Assistant
     même origine, aucun CORS                          127.0.0.1:8080        192.168.1.51:8123
```

- `pont` tourne dans **le même pod** que nginx (conteneur *sidecar*) : même espace réseau, donc
  `127.0.0.1:8080` — et **le port du pont n'est pas publié** par le Service (seul le port 80 l'est).
- Le dashboard appelle `/api/etat` et `/api/prise` **sur sa propre origine** : ni CORS, ni jeton
  côté client, et rien de nouveau à autoriser dans Home Assistant.
- Le jeton vit dans le secret `scada-opus/pont-ha`, monté dans le pod, et n'est jamais journalisé.

| Route | Rôle |
|---|---|
| `GET /api/sante` | renvoie `ok`, **sans** authentification : c'est la sonde de Kubernetes |
| `GET /api/etat` | état des 5 prises + 4 sondes (valeur, unité, batterie, disponibilité) |
| `POST /api/prise` | `{"entite": "switch.…_outlet_N", "allume": true}` → commande puis **relit** l'état réel |

Le pont ne peut commander **que** les prises de la liste blanche `PONT_PRISES` : entité hors
liste → 403, corps invalide → 400, requête sans jeton → 401. Le nom du service appelé chez Home
Assistant (`switch.turn_on` / `switch.turn_off`) est choisi par le pont, jamais par l'appelant.

### Créer le secret (une fois, avant le premier déploiement du pont)

Un jeton ne se commite pas : le secret est créé hors GitOps, sur le serveur.

```bash
TOKEN=$(kubectl -n default get secret fermentation-v3-ha -o jsonpath='{.data.HASS_TOKEN}' | base64 -d)
JETON=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | cut -c1-24)
kubectl -n scada-opus create secret generic pont-ha \
  --from-literal=HASS_TOKEN="$TOKEN" --from-literal=PONT_JETON="$JETON" \
  --dry-run=client -o yaml | kubectl apply -f -
```

Sans ce secret le pod ne démarre pas (`secretKeyRef` non optionnel) : **créer le secret avant de
pousser** le déploiement du pont.

**Le jeton du pont** se lit sur le serveur. Il se saisit une seule fois par navigateur, la page
le retient ensuite :

```bash
kubectl -n scada-opus get secret pont-ha -o jsonpath="{.data.PONT_JETON}" | base64 -d; echo
```

Pour ne plus le demander : recréer le secret **sans** la clé `PONT_JETON`. Le pont n'exigera
alors plus d'authentification — à éviter, toute machine du réseau pourrait commander les prises.

### Ce que fait le dashboard quand le pont n'est pas là

| Situation | Comportement |
|---|---|
| Page ouverte directement (`file://`) | maquette pure : aucune requête réseau, aucune commande — le fichier reste utilisable seul |
| Servie par le cluster, pont injoignable | le clic affiche « Pont Home Assistant injoignable » et **ne simule rien** : on n'affiche jamais une prise allumée qui ne l'est pas |
| Pont joignable | la démonstration de chauffe se tait sur les appareils réels : Home Assistant fait foi, et le dashboard **n'allume rien de lui-même** — seuls tes clics commandent |

### Vérifier après déploiement

```bash
curl -s  http://192.168.1.51:30090/api/sante; echo                                  # ok
curl -s -o /dev/null -w '%{http_code}\n' http://192.168.1.51:30090/api/etat          # 401 sans jeton
cd scada-opus-5.5/_verify && JETON_PONT="$(…)" node verif-pont-bout-en-bout.mjs       # clique pour de vrai : allume, vérifie, éteint
```

## Revenir en arrière

```bash
git revert <commit>      # le tag revient à la valeur précédente, Argo redéploie l'image d'avant
```

Aucune image n'est écrasée : chaque build produit un tag `scada-opus-<sha>` immuable, donc
n'importe quelle version peut être réépinglée en changeant `newTag` dans `kustomization.yaml`.

## Pourquoi ce montage

- **Tag immuable + écriture dans git** plutôt qu'un tag mutable `:latest` : ArgoCD ne
  redéploie que ce qui change dans git, et son historique dit exactement quelle image
  tourne. C'est ce qui manquait au motif `manifests/frontend-scada.yaml`, où le tag
  épinglé devait être mis à jour à la main (d'où l'annotation `restartedAt`).
- **Paquet GHCR public** : le cluster tire l'image sans secret (`imagePullSecrets` absent
  dans le namespace `default` de tes autres apps, et c'est ainsi que
  `ghcr.io/timbenedet/myfermentlab-frontend` fonctionne déjà).
- **NodePort en plus de l'ingress** : les noms `*.myfermentlab` ne résolvent pas depuis
  tous les postes du réseau, l'accès par IP reste donc toujours possible.
- **namespace dédié** : `scada-opus`, pour que `prune: true` ne puisse jamais toucher aux
  ressources de `default` ou `manga`.

## Amorçage — la toute première mise en route

Une seule fois, dans cet ordre :

1. **Premier build vert.** Le pipeline démarre tout seul au premier push qui touche
   `scada-opus-5.5/`. Vérifier que l'étape *Publier l'image sur GHCR* passe, puis que le
   commit `chore(scada): déploie l'image …` apparaît sur la branche.
2. **Paquet public.** Vérifié le 23/09 : les paquets publiés depuis ce dépôt public le sont
   aussi — `myfermentlab-scada` se tire sans authentification, comme `myfermentlab-frontend`.
   Si le réglage changeait un jour :
   `https://github.com/users/TimBenedet/packages/container/myfermentlab-scada/settings` →
   *Change visibility* → **Public**. Sans cela, le cluster reçoit un 401 et reste en
   `ImagePullBackOff`.
3. **Appliquer l'Application ArgoCD**, une fois, à la main :
   ```bash
   kubectl apply -f scada-opus-5.5/argocd/application.yaml
   kubectl -n argocd get app scada-opus-5.5 -w
   ```
   ArgoCD crée le namespace `scada-opus` et déploie. Ensuite, plus rien à faire à la main :
   tout passe par git.

## Si la CI échoue à pousser le tag

L'étape d'épinglage a besoin d'écrire sur la branche. Le workflow déclare
`permissions: contents: write`, ce qui **prime** sur le réglage par défaut du dépôt
(*Settings → Actions → Workflow permissions*) : inutile de le modifier. Si un 403 apparaît
malgré tout, c'est une **protection de branche ou un ruleset** qui refuse le push du
`github-actions[bot]` — autoriser ce robots à écrire sur `Scada-opus-5.5` (ou retirer la
règle le temps du premier passage). Le job devient rouge et prévient par courriel ;
les images, elles, sont déjà publiées, donc le cluster reste simplement sur le tag
précédent : rien ne casse.

## La chaîne a été exercée de bout en bout

Test réel du 23 septembre 2026, sans aucune intervention manuelle entre le push et le site à jour :

| Étape | Constat mesuré |
|---|---|
| `git push` du commit `aa19100` (modification de `index.html`) | déclenche le workflow tout seul |
| GitHub Actions (run `35840478416`) | vert : image `ghcr.io/timbenedet/myfermentlab-scada:scada-opus-aa19100` publiée |
| écriture dans git | commit `1b591d2 chore(scada): déploie l'image scada-opus-aa19100 [skip ci]` — et **aucun** nouveau run déclenché |
| ArgoCD | révision passée à `1b591d2`, rolling update terminé, application `Synced` / `Healthy` |
| site | nouvelle page servie sur `:30090` **et** via `hakko.myfermentlab` ; dashboard inchangé (`sha256 477502b6…`) |

Délai observé entre le `git push` et le site à jour : **environ deux minutes**, dont l'attente
du cycle de réconciliation d'ArgoCD (~3 min au pire sans rafraîchissement forcé).

## Ce qui n'est pas en place

- **Pas de webhook ArgoCD** : le cluster est sur une IP privée, GitHub ne peut pas l'atteindre,
  ArgoCD *poll* donc le dépôt toutes les ~3 minutes. Baisser `timeout.reconciliation` à `60s`
  dans `argocd-cm` accélère **toutes** les applications du cluster.
- **Pas d'alerte** si l'application passe en `Degraded` (le contrôleur de notifications ArgoCD
  est pourtant installé dans le cluster).
- Le tag est épinglé par un `sed` avec ancrage, plutôt que par `kustomize edit set image`
  (kustomize n'est pas installé sur les runners GitHub).
