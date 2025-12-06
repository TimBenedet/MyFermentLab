# Add Feature - Ajout de fonctionnalité

Ajoute une nouvelle fonctionnalité à l'application MyFermentLab.

## Étapes à suivre

1. **Analyse** : Comprendre la fonctionnalité demandée
2. **Exploration** :
   - Identifier les fichiers existants à modifier
   - Vérifier les types dans `src/types.ts`
   - Vérifier les services API dans `src/services/`
3. **Planification** : Lister les modifications nécessaires
   - Frontend (React/TypeScript)
   - Backend (Express/Node.js) si nécessaire
   - Base de données (InfluxDB/fichiers JSON) si nécessaire
4. **Implémentation** :
   - Modifier les types si nécessaire
   - Implémenter le backend si nécessaire
   - Implémenter le frontend
   - Ajouter les styles CSS
5. **Test** : Exécuter `npm run build` pour vérifier

## Architecture du projet

### Frontend (`src/`)
- `pages/` - Composants de pages principales
- `components/` - Composants réutilisables
- `services/` - Services API et utilitaires
- `types.ts` - Types TypeScript partagés

### Backend (`backend/src/`)
- `routes/` - Routes Express
- `services/` - Services métier (InfluxDB, MQTT, etc.)
- `types/` - Types TypeScript backend

## Conventions

- Composants React en PascalCase
- Fichiers CSS associés au même nom que le composant
- API REST avec préfixe `/api/`
- Types partagés exportés depuis `types.ts`
