import { Router, Request, Response } from 'express';
import { databaseService } from '../services/database.service.js';
import { requireAuth, requireAdmin } from './auth.routes.js';

const router = Router();

// GET /api/recipes - Liste toutes les recettes
router.get('/', async (req: Request, res: Response) => {
  try {
    const recipes = databaseService.getAllRecipes();
    res.json(recipes);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/recipes/:id - Récupère une recette
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const recipe = databaseService.getRecipe(id);
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    res.json(recipe);
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/recipes - Créer une recette
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id, projectType, name, style, batchSize, og, fg, abv, ibu, srm, ingredients, steps } = req.body;

    if (!name || !projectType) {
      return res.status(400).json({ error: 'Name and projectType are required' });
    }

    const recipeId = id || Date.now().toString();
    const recipe = databaseService.createRecipe({
      id: recipeId,
      projectType,
      name,
      style: style || '',
      batchSize: batchSize || 25,
      og: og || 1.0,
      fg: fg || 1.0,
      abv: abv || 0,
      ibu: ibu || 0,
      srm: srm || 0,
      ingredients: ingredients || [],
      steps: steps || [],
      createdAt: Date.now(),
    });

    res.status(201).json(recipe);
  } catch (error) {
    console.error('Error creating recipe:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/recipes/:id - Modifier une recette
router.put('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const recipe = databaseService.getRecipe(id);
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const updated = databaseService.updateRecipe(id, req.body);
    res.json(updated);
  } catch (error) {
    console.error('Error updating recipe:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/recipes/:id - Supprimer une recette
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const recipe = databaseService.getRecipe(id);
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    databaseService.deleteRecipe(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
