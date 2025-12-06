# Fix UI - Correction d'interface

Corrige un problème d'interface utilisateur à partir d'une capture d'écran.

## Étapes à suivre

1. **Analyse** : Examine la capture d'écran fournie par l'utilisateur
2. **Identification** :
   - Identifie le composant React concerné dans `src/pages/` ou `src/components/`
   - Trouve le fichier CSS associé (`.css` dans le même dossier)
3. **Diagnostic** : Explique brièvement le problème identifié
4. **Correction** :
   - Modifie le CSS ou le composant React selon le besoin
   - Privilégie les corrections CSS simples
5. **Vérification** : Exécute `npm run build` pour s'assurer que ça compile

## Types de problèmes courants

- Alignement / espacement
- Superposition d'éléments
- Couleurs / contraste
- Responsive design
- Overflow / scroll
- Z-index

## Fichiers principaux

- `src/App.css` - Styles globaux et composants communs
- `src/pages/*.css` - Styles spécifiques aux pages
- `src/components/*.css` - Styles des composants réutilisables

## Notes

- Ne pas modifier la logique métier, uniquement le visuel
- Garder la cohérence avec le design existant (thème sombre, couleur dorée #c4a574)
