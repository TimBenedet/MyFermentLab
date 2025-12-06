# Deploy - Build, Push, Sync & Restart

Déploie les changements sur le cluster Kubernetes.

## Étapes à suivre

1. **Build** : Exécute `npm run build` pour vérifier que tout compile
2. **Git Status** : Vérifie les fichiers modifiés avec `git status` et `git diff`
3. **Commit & Push** :
   - Génère un message de commit approprié basé sur les changements
   - Commit avec le format standard (incluant le footer Claude Code)
   - Push vers origin/main
4. **Attendre le build Docker** :
   - Vérifie le statut des GitHub Actions via WebFetch : `https://api.github.com/repos/TimBenedet/MyFermentLab/actions/runs?per_page=1`
   - Attends que le workflow soit "completed" avec conclusion "success"
   - Vérifie toutes les 15 secondes jusqu'à completion (timeout 5 minutes)
5. **Sync ArgoCD** (via SSH sur le serveur avec kubectl) :
   - Connexion : `sshpass -p 'berlin' ssh -o StrictHostKeyChecking=no homelab@192.168.1.51`
   - Commande pour sync : `kubectl patch application myfermentlab -n argocd --type merge -p '{"operation":{"sync":{"syncStrategy":{"hook":{}}}}}'`
   - Ou hard refresh : `kubectl annotate application myfermentlab -n argocd argocd.argoproj.io/refresh=hard --overwrite`
6. **Restart des pods** (via SSH sur le serveur) :
   - Frontend : `kubectl delete pods -l app=fermentation-monitor -n default`
   - Backend : `kubectl delete pods -l app=fermentation-backend -n default`
7. **Confirmation** : Affiche un résumé du déploiement

## Connexion SSH

- Serveur : 192.168.1.51
- User : homelab
- Password : berlin
- Commande SSH : `sshpass -p 'berlin' ssh -o StrictHostKeyChecking=no homelab@192.168.1.51 "COMMANDE"`

## En cas d'erreur

- Si le build échoue : affiche les erreurs et arrête
- Si le push échoue : vérifie la connexion git
- Si GitHub Actions échoue : affiche le lien vers les logs
- Si SSH échoue : vérifie la connectivité réseau vers 192.168.1.51
- Si ArgoCD échoue : vérifier que l'app myfermentlab existe avec `kubectl get applications -n argocd`
- Si kubectl échoue : vérifier les labels avec `kubectl get pods -n default --show-labels`

## Notes

- Ne jamais force push
- Toujours attendre la confirmation du build Docker avant de sync
- Les commandes kubectl et argocd sont disponibles sur le serveur 192.168.1.51
