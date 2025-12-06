# Check Build - Vérifier le statut du build Docker

Vérifie le statut du dernier build GitHub Actions.

## Étapes à suivre

1. **Récupérer le statut** :
   - Utilise WebFetch sur `https://api.github.com/repos/TimBenedet/MyFermentLab/actions/runs?per_page=5`
   - Extrais le statut des derniers workflows

2. **Afficher les résultats** :
   - Commit SHA
   - Message de commit
   - Statut (queued, in_progress, completed)
   - Conclusion (success, failure, cancelled)
   - Durée du build

## Interprétation

- `queued` : En attente de runner
- `in_progress` : Build en cours
- `completed` + `success` : Prêt à déployer
- `completed` + `failure` : Erreur, vérifier les logs
