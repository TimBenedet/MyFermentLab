# Debug API - Débogage des erreurs API

Diagnostique et corrige les erreurs liées à l'API backend.

## Étapes à suivre

1. **Identifier l'erreur** :
   - Quel endpoint pose problème ?
   - Quel code d'erreur (400, 404, 500, etc.) ?
   - Quel message d'erreur ?

2. **Vérifier la route** :
   - Chercher dans `backend/src/routes/`
   - Vérifier que la route existe et est correctement définie
   - Vérifier les paramètres attendus

3. **Vérifier le service** :
   - Chercher dans `backend/src/services/`
   - Vérifier la logique métier
   - Vérifier les appels à InfluxDB ou autres services

4. **Vérifier le frontend** :
   - Chercher dans `src/services/api.service.ts`
   - Vérifier que l'appel API est correct
   - Vérifier les paramètres envoyés

5. **Corriger** : Appliquer la correction identifiée

6. **Tester** : `npm run build` pour le frontend

## Routes principales

- `GET /api/projects` - Liste des projets
- `POST /api/projects` - Créer un projet
- `GET /api/projects/:id` - Détails d'un projet
- `PUT /api/projects/:id` - Modifier un projet
- `DELETE /api/projects/:id` - Supprimer un projet
- `GET /api/projects/:id/stats` - Statistiques d'un projet
- `GET /api/projects/:id/temperature` - Historique température

## Services backend

- `influx.service.ts` - Requêtes InfluxDB
- `mqtt.service.ts` - Communication MQTT avec ESP32
- `projects.routes.ts` - Routes projets
