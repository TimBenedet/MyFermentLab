import { useCallback, useEffect, useState } from 'react';
import { createProduction, productionOf, readProductions, writeProductions } from '../lib/production';
import type { Production, Recipe } from '../types';

export interface ProductionStore {
  /** Lots en production, dans l'ordre de lancement. */
  readonly productions: readonly Production[];
  /** Lance un lot depuis une recette. Une recette déjà lancée n'en lance pas un second. */
  readonly start: (recipe: Recipe) => void;
  readonly stop: (id: string) => void;
  /** Arrête le lot d'une recette donnée, s'il existe. */
  readonly stopRecipe: (recipeId: string) => void;
}

/**
 * Lots en production, persistés dans `localStorage` à chaque changement — comme les
 * recettes et le thème. Le magasin ne contient que les lots **en cours** : arrêter un
 * lot l'efface, il n'y a pas d'historique de production à administrer.
 */
export function useProductions(): ProductionStore {
  const [productions, setProductions] = useState<readonly Production[]>(readProductions);

  useEffect(() => {
    writeProductions(productions);
  }, [productions]);

  const start = useCallback((recipe: Recipe) => {
    setProductions((current) =>
      productionOf(current, recipe.id) === null
        ? [...current, createProduction(recipe, Date.now())]
        : current,
    );
  }, []);

  const stop = useCallback((id: string) => {
    setProductions((current) => current.filter((production) => production.id !== id));
  }, []);

  const stopRecipe = useCallback((recipeId: string) => {
    setProductions((current) =>
      current.filter((production) => production.recipeId !== recipeId),
    );
  }, []);

  return { productions, start, stop, stopRecipe };
}
