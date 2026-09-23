# Revue GitOps — Opus 5.5

> Revue produite par `claude --model opus` (Opus 5.5) sur le pipeline complet.
> Le fichier de sortie demandé n'a pas pu être créé par l'agent (permission refusée),
> ce texte est donc sa réponse verbatim.

The pipeline isn't ready to apply as it stands, and I couldn't write the report: permission to create `scada-opus-5.5/_verify/revue-gitops-opus.md` was refused, so no file was created or changed. Here is the full review; I can write it to that file once you allow it.

The workflow was also changed while I was reviewing it. The commit `4c84d0c` fixed a first blocker: `paths` and `paths-ignore` together made GitHub reject the file (no job at all). The line numbers below refer to the current version. `scada-opus-5.5/Dockerfile` and `nginx.conf` also have local changes that aren't committed, so the CI builds the committed version, not the one I read.

## 1. Verdict
**No, not as it stands.** The CI build will fail: the image name contains `TimBenedet` in mixed case, and Docker requires lowercase. No image gets published, so the first ArgoCD sync stays in `ImagePullBackOff` on `:latest`. With that one line fixed, the chain holds, but the new GHCR package is probably private, the CI has no `concurrency` guard or rebase before its push, and `DEPLOIEMENT.md` doesn't explain the first-time setup and gives the wrong fix for a 403.

## 2. Findings

| Sévérité | Fichier:ligne | Problème | Correctif concret |
|---|---|---|---|
| **BLOQUANT** | `build-scada-opus.yml:24` (utilisé l.59-60) | `${{ github.repository_owner }}` vaut `TimBenedet`, en casse mixte. Buildx refuse les majuscules (*repository name must be lowercase*). Les workflows existants y échappent parce que `docker/metadata-action` met en minuscules (`build-frontend.yml:39-43`). | l.24 : `IMAGE_NAME: timbenedet/myfermentlab-scada`, la même valeur que `kustomization.yaml:16`. |
| **MAJEUR** | `DEPLOIEMENT.md:81-83`, `deployment.yaml:28` | `myfermentlab-scada` est un **nouveau** paquet, donc privé par défaut. Que le frontend soit public ne dit rien de celui-ci. Sans secret de pull, le cluster prend un 401 et reste en `ImagePullBackOff` indéfiniment. | Après le 1er build vert : *Package settings* → *Change visibility* → **Public**. Le documenter dans une section « Amorçage ». |
| **MAJEUR** | `build-scada-opus.yml:26-31`, `:91` | Ni `concurrency` ni rebase. Deux pushes rapprochés : le job périmé échoue en non-fast-forward, et `:latest` suit celui qui finit en dernier. Un simple rebase sans file d'attente permettrait à un build ancien d'épingler une vieille image. | Au niveau du job : `concurrency: { group: scada-opus-deploy, cancel-in-progress: false }`. Avant l.91 : `git pull --rebase origin "${GITHUB_REF_NAME}"`. |
| **MAJEUR** | `DEPLOIEMENT.md:52-54` | La CI commite sur la branche : le `git push` local suivant est rejeté (non-fast-forward). La procédure ne marche qu'une fois. | l.54 : `… && git pull --rebase && git push`, ou `git config pull.rebase true`. |
| **MAJEUR** | `DEPLOIEMENT.md:89-94` | Mauvais remède. `permissions: contents: write` (l.30) prend le pas sur le réglage par défaut du dépôt. Un 403 viendrait d'une protection de branche ou d'un ruleset. | Réécrire la section : autoriser `github-actions[bot]` à contourner la protection de branche ou le ruleset (ou retirer la protection). Ne rien changer à *Workflow permissions*. |
| **MAJEUR** | `DEPLOIEMENT.md` (section absente) | Rien n'explique qu'il faut appliquer l'Application une fois à la main, ni dans quel ordre. | Section « Amorçage » : run vert → paquet public → `kubectl apply -f scada-opus-5.5/argocd/application.yaml`. |
| **MINEUR** | `build-scada-opus.yml:80`, `:85-88` | Si la ligne `newTag` est absente, rien n'est remplacé et le job sort en succès sans rien déployer. Le `sed` réécrit aussi **toutes** les lignes `newTag:` du fichier. | `kustomize edit set image ghcr.io/timbenedet/myfermentlab-scada=…:$TAG`, puis `grep -q "newTag: $TAG$" \|\| exit 1`. |
| **MINEUR** | `build-scada-opus.yml:60` | `:latest` est poussé avant le write-back, donc il peut désigner une image que git n'a jamais épinglée. | Ne garder `:latest` que pour l'amorçage. |
| **MINEUR** | `deployment.yaml:29` | `Always` avec des tags immuables : chaque démarrage de pod dépend de GHCR, même au reboot. | `IfNotPresent` une fois le premier tag épinglé. |
| **MINEUR** | `namespace.yaml` + `application.yaml:8-10` | Le Namespace est géré par Argo. Supprimer l'app (finalizer) supprime `scada-opus` et **tout** son contenu, y compris ce qui a été créé à la main. | Annotation `argocd.argoproj.io/sync-options: "Prune=false,Delete=false"`, ou bien `managedNamespaceMetadata` à la place de `namespace.yaml`. |
| **MINEUR** | `Dockerfile:27`, `.dockerignore:3-4` | `k8s/`, `argocd/` et `DEPLOIEMENT.md` sont servis publiquement, et la copie de `k8s/` servie est toujours périmée. | Ajouter `k8s/` et `argocd/` au `.dockerignore`. |
| **MINEUR** | `DEPLOIEMENT.md:68-70` | Le `git revert` ne précise pas quel commit annuler. | Commit `chore(scada)` = retour immédiat ; commit source = retour durable, avec rebuild. Pas de *Rollback* dans l'UI Argo tant que l'auto-sync est actif. |
| **NIT** | `build-scada-opus.yml:7` / `:75` / `:68` | Le commentaire mentionne encore `paths-ignore` ; le `grep` n'est pas ancré ; le write-back n'est pas limité à cette branche. | Corriger le commentaire ; `grep -qE "^\s*newTag: $TAG\s*$"` ; `if: github.ref == 'refs/heads/Scada-opus-5.5'`. |

## 3. Answers to the 8 questions
1. **Runaway loop: no.** Three independent guards, each enough on its own. A push made with the `GITHUB_TOKEN` (l.91) triggers no workflow. `'!scada-opus-5.5/k8s/**'` (l.17) comes after l.13, so it wins. The commit message carries `[skip ci]` (l.90).
2. **First sync: yes, the tag points to a missing image** (`kustomization.yaml:19`). The sync succeeds but the pods go to `ImagePullBackOff`, and the app shows `Degraded` after 600 s. It fixes itself within about 5 minutes once `:latest` exists **and** is public, thanks to `Always` and the kubelet retrying. Otherwise it stays stuck. After that, the order is correct: the image is pushed (l.51-66) before the commit that references it (l.90-91).
3. **Read-only by default:** for a personal repo that setting only applies to workflows without a `permissions:` block, so the job still gets `write`. If a branch protection rule refuses the push, `set -euo pipefail` (l.72) marks the job red and GitHub emails you. The failure is visible, but the images are already published and the cluster stays on the old tag.
4. **`sed`:** the anchor is correct and it can safely run twice (l.75 skips the rewrite if the tag is already there). But it rewrites every `newTag:` line in the file, and if the line is missing it silently exits 0.
5. **Namespace:** the two declarations overlap but don't conflict. Argo only prunes what it tracks, so `default`, `manga` and `argocd` are safe. The one exception: deleting the app, or removing `namespace.yaml` with `prune: true`, deletes `scada-opus` and everything in it, including objects created by hand.
6. **Rolling update:** it won't block. `maxSurge: 1` with small requests leaves room for a third pod on the single node. `maxUnavailable: 0` actually protects you: if the new version is broken, the two old pods keep serving. The 94 MB only matters for the first pull.
7. **Consistency:** probes, port name `http`, Service → Ingress and selectors all match. `Always` + `latest` only makes sense during the first-time setup.
8. **What's missing:** the `concurrency` guard and rebase (CI and local); `timeout.reconciliation: 60s` in `argocd-cm` (a webhook can't reach a private IP); an `on-health-degraded` alert in `argocd-notifications`; and a documented setup and rollback procedure.

## 4. Checked vs assumed
- **Checked**, by reading the files and read-only git:
  - all the audited files and their line numbers;
  - `HEAD` = `origin` = `4c84d0c`;
  - `TimBenedet` is the repo owner, and the new workflow doesn't use `metadata-action`;
  - no write-back commit exists yet;
  - `Dockerfile` and `nginx.conf` have uncommitted local changes.
- **Not run**: network access to GitHub and GHCR was refused, so I didn't see the run logs or the package's visibility. The lowercase failure and the private-by-default package come from the documented behaviour of buildx and GitHub Packages, not from what I observed. My test of the `sed` was refused, and I ran no `docker`, `kubectl` or `kustomize`. To confirm: `docker pull ghcr.io/timbenedet/myfermentlab-scada:latest` from a machine that isn't logged in to GHCR.

## 5. Improvements
1. Lowercase `IMAGE_NAME`, plus `concurrency` and `pull --rebase` in the CI (about 5 lines).
2. First-time setup: make the package public, `kubectl apply` the Application, fix `DEPLOIEMENT.md`, then switch to `IfNotPresent`.
3. Argo notifications on `Degraded`, plus `timeout.reconciliation: 60s`.
