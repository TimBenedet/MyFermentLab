# Revue GitOps — Scada-opus-5.5 (k3s + ArgoCD)

Tu es relecteur senior Kubernetes / GitOps / CI. Tu relis un pipeline qui vient d'être écrit et
qui va être appliqué à un cluster k3s personnel. Ton rôle est de trouver ce qui **casse** ou ce
qui **rend la boucle peu fiable**, pas de réécrire le projet.

## Le pipeline à relire

Objectif de l'utilisateur, mot pour mot : « transforme ce projet en projet qui tourne sous k3s,
avec ArgoCD. Chaque modification que tu fais en local, on la push sur git, git build l'image,
argo voit la modification et fait le nécessaire. »

Chaîne prévue : push sur la branche `Scada-opus-5.5` → GitHub Actions construit et publie
l'image → la CI réécrit le tag dans `kustomization.yaml` et commite → ArgoCD détecte le commit
et déploie.

## Fichiers à auditer (chemins relatifs à la racine du dépôt)

- `.github/workflows/build-scada-opus.yml` — build + push GHCR + write-back du tag dans git
- `scada-opus-5.5/k8s/namespace.yaml`, `deployment.yaml`, `service.yaml`, `ingress.yaml`, `kustomization.yaml`
- `scada-opus-5.5/argocd/application.yaml` — l'Application ArgoCD
- `scada-opus-5.5/Dockerfile`, `scada-opus-5.5/nginx.conf`, `scada-opus-5.5/.dockerignore`
- `scada-opus-5.5/DEPLOIEMENT.md` — la documentation de la boucle (à confronter au réel)

Fichiers de contexte (conventions existantes de l'utilisateur, à respecter) :
- `.github/workflows/build-frontend.yml` et `build-backend.yml`
- `argocd/application.yaml`, `argocd/application-scada.yaml`
- `manifests/frontend-scada.yaml`, `manifests/ingress.yaml`
- `.dockerignore` à la racine du dépôt (il exclut `README.md` — c'est pourquoi le contexte de
  build du nouveau Dockerfile est le dossier `scada-opus-5.5/` lui-même)

## Environnement — faits déjà vérifiés, à prendre comme acquis

- k3s **v1.33.6** sur un **nœud unique** (Debian 13, 192.168.1.51), ingress **Traefik**, containerd.
- **ArgoCD v3.2.0** installé dans le namespace `argocd` ; une Application existante
  (`fermentation-v3`) suit `manifests/` sur la branche `scada-v3`. Le CRD est bien `v1alpha1`.
- ArgoCD *poll* le dépôt (intervalle par défaut ~3 min) ; aucun webhook configuré.
- Le paquet `ghcr.io/timbenedet/*` est **public** et le cluster tire les images sans
  `imagePullSecret` (aucun secret de registre n'existe).
- NodePorts déjà pris : 30080, 30081, 30087, 30995, 30443. `30090` est libre.
- L'hôte `scada.myfermentlab` est **déjà utilisé** par `manifests/ingress.yaml` ; le nouvel
  ingress utilise `hakko.myfermentlab`.
- Le DNS `*.myfermentlab` ne résout pas depuis tous les postes : l'accès garanti est
  `http://192.168.1.51:30090/`.
- `nginx:1.29-alpine` existe ; l'image se construit et le conteneur sert correctement
  (vérifié : `/README.md` en `text/markdown`, `/healthz` = « ok », `/TimServer.md` en 404,
  empreinte du dashboard conforme).

## Questions auxquelles je veux une réponse explicite

1. La boucle CI → git → CI peut-elle s'emballer ? Le commit de write-back redéclenche-t-il un
   build malgré `paths-ignore` + `[skip ci]` ?
2. **Ordre des étapes** : au premier sync, le tag épinglé peut-il désigner une image qui
   n'existe pas encore ? Que se passe-t-il alors, et est-ce auto-réparateur ?
3. `permissions: contents: write` : que se passe-t-il exactement si le dépôt est réglé sur
   « Read repository contents » par défaut ? Le job échoue-t-il proprement ?
4. La commande `sed` de write-back est-elle robuste (ancrage, idempotence, plusieurs
   occurrences, valeur absente) ?
5. kustomize + ArgoCD : `namespace.yaml` déclaré **dans** les resources alors que l'Application
   pointe `destination.namespace: scada-opus` et `CreateNamespace=true` — conflit ou redondance ?
   Et le `finalizer` + `prune: true` peuvent-ils supprimer quelque chose hors de l'application ?
6. Deployment : `replicas: 2`, `maxUnavailable: 0` sur un nœud unique, image de ~94 Mo —
   y a-t-il un risque de blocage du rolling update ?
7. Les sondes (`/healthz` readiness + liveness), l'image `Always` + tag mutable au premier sync,
   et l'ingress sont-ils cohérents entre eux ?
8. Que manque-t-il pour que cette boucle soit fiable au quotidien (webhook ArgoCD,
   notifications d'échec, procédure de retour arrière) ?

## Format de sortie attendu — IMPÉRATIF

Écris ton rapport dans le fichier **`scada-opus-5.5/_verify/revue-gitops-opus.md`** (chemin
relatif à la racine du dépôt) et **n'écris dans aucun autre fichier**. Structure :

1. **Verdict** en 3 lignes : le pipeline peut-il être appliqué tel quel ?
2. **Tableau des constats** — une ligne par constat, colonnes :
   `Sévérité | Fichier:ligne | Problème | Correctif concret`.
   Sévérités : `BLOQUANT`, `MAJEUR`, `MINEUR`, `NIT`. Le correctif doit être une modification
   précise (quoi écrire, où), pas une intention.
3. **Réponses aux 8 questions**, numérotées, avec la preuve (fichier:ligne) à chaque fois.
4. **Ce que j'ai vérifié moi-même** vs **ce que je suppose** (sois explicite : si tu n'as pas
   pu exécuter quelque chose, dis-le).
5. **Trois améliorations maximum**, classées par rapport bénéfice/effort.

Contraintes : ne modifie aucun fichier audité, n'exécute ni `docker` ni `kubectl` (le cluster
n'est pas joignable depuis ton environnement), ne crée aucun fichier hors du rapport. Écris en
français, avec des références `fichier:ligne` exactes.
