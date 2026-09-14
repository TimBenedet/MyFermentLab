---
description: Moteur de simulation local (historique 24 h, ticks 2 s, bruit/dérive) et hook de branchement React.
---

# Agent — Simulation

## Écriture

- `src/simulation/engine.ts`
- `src/hooks/useFermentationFeed.ts`
- `src/lib/random.ts`

Rien d'autre. **Aucun fichier `.tsx`.**

## Lecture seule

- `src/types.ts`
- `src/config/fermentations.ts`
- `src/lib/status.ts`
- `src/lib/reading.ts`

## Contrat

```ts
export const TICK_MS = 2_000;
export const HISTORY_STEP_MS = 30_000;
export const HISTORY_WINDOW_MS = 86_400_000;

export class FermentationEngine {
  constructor(configs: readonly FermentConfig[], nowMs?: number);
  advance(nowMs: number): void;
  setTemperatureSetpoint(id: FermentId, value: number): void;
  snapshot(): Feed;
}

export interface FermentationFeed extends Feed {
  readonly setTemperatureSetpoint: (id: FermentId, value: number) => void;
}

export function useFermentationFeed(): FermentationFeed;
```

- Processus d'Ornstein-Uhlenbeck par canal, cycles lents, perturbations ponctuelles,
  densité en fonction **pure** du temps.
- 24 h d'historique rétroactif au montage, puis archivage toutes les 30 s, fenêtre
  glissante bornée (jamais de croissance infinie).
- `snapshot().history` est **toujours un nouveau tableau** (sinon React mémoïse à tort).
- Toute la mutation d'état reste interne à la classe ; React ne voit que de l'immuable.
- `setTemperatureSetpoint` met à jour **le canal de mesure et la config**. Sans la config,
  `assess()` calculerait l'écart contre l'ancienne cible : la pastille resterait verte sur
  une cuve à 3 °C de sa nouvelle consigne. La config est remplacée, jamais mutée.
- Le hook renvoie un `snapshot()` **immédiat** après la commande : sans lui, une consigne
  validée ne se verrait qu'au tick suivant, jusqu'à 2 s plus tard.

## Interdit

- Appeler `useFermentationFeed` depuis un autre module de simulation.
- Générer des données dans un composant.
- Écrire dans `src/components/**` ou `src/App.tsx`.

## Terminé quand

Le hook compile (`tsc --noEmit` sans erreur, zéro `any`) et un script de démo affiche
10 itérations plausibles : valeurs qui oscillent autour de la consigne, écarts bornés,
aucune valeur `NaN`, historique borné à 24 h.
