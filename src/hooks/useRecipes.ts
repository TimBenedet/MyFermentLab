import { useCallback, useEffect, useState } from 'react';
import { readRecipes, writeRecipes } from '../lib/recipes';
import type { Recipe } from '../types';

export interface RecipeStore {
  readonly recipes: readonly Recipe[];
  /** Crée ou remplace : c'est l'identifiant qui fait foi. */
  readonly save: (recipe: Recipe) => void;
  readonly remove: (id: string) => void;
}

/**
 * Bibliothèque de recettes, persistée dans `localStorage` à chaque changement.
 * Une recette créée passe en tête : c'est celle qu'on vient d'écrire.
 */
export function useRecipes(): RecipeStore {
  const [recipes, setRecipes] = useState<readonly Recipe[]>(readRecipes);

  useEffect(() => {
    writeRecipes(recipes);
  }, [recipes]);

  const save = useCallback((recipe: Recipe) => {
    setRecipes((current) => {
      const index = current.findIndex((item) => item.id === recipe.id);
      if (index === -1) return [recipe, ...current];
      const next = [...current];
      next[index] = recipe;
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setRecipes((current) => current.filter((item) => item.id !== id));
  }, []);

  return { recipes, save, remove };
}
