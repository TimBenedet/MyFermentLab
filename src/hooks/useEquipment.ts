import { useCallback, useEffect, useState } from 'react';
import { readEquipment, writeEquipment } from '../lib/equipment';
import type { EquipmentProfile } from '../types';

export interface EquipmentStore {
  readonly equipment: EquipmentProfile;
  /** Remplace la cuve : c'est elle qui fait foi, il n'y en a qu'une. */
  readonly update: (equipment: EquipmentProfile) => void;
}

/**
 * Matériel courant, persisté dans `localStorage` à chaque changement.
 *
 * Le magasin vit dans la bibliothèque, à côté des recettes — c'est le même écran qui
 * s'en sert, à la création comme en détail. Deux `useEquipment()` côte à côte
 * donneraient deux cuves : celle qu'on vient de corriger, et l'autre.
 */
export function useEquipment(): EquipmentStore {
  const [equipment, setEquipment] = useState<EquipmentProfile>(readEquipment);

  useEffect(() => {
    writeEquipment(equipment);
  }, [equipment]);

  const update = useCallback((next: EquipmentProfile) => setEquipment(next), []);

  return { equipment, update };
}
