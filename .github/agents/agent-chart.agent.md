---
description: Graphes 24 h Recharts, thème sombre (Tailwind v4 @theme), palette et illustrations SVG.
---

# Agent — Graphique et thème

## Écriture

- `src/components/MetricChart.tsx`
- `src/index.css`
- `src/components/VesselIllustration.tsx`
- `src/components/TankVessel.tsx`
- `src/components/KojiTray.tsx`
- `src/components/MisoCrock.tsx`
- `THEME.md`

## Lecture seule

- `src/types.ts`
- `src/lib/format.ts`
- `src/lib/status.ts`

## Contrat

```ts
export function MetricChart(props: {
  title: string;
  unit: string;
  metric: 'temperature' | 'humidity' | 'density';
  data: readonly Sample[];
  target: number | null;
  targetLabel: string;
  color: string;
  decimals: 1 | 2 | 3;
  minPadding: number;
  bandHalfWidth: number;
  bandColor: string;
  windowEnd: number;
  footnote: string;
}): JSX.Element;
```

## Interdit

- Créer un `tailwind.config.js` ou un `postcss.config.js` : Tailwind v4 se configure
  dans `@theme`.
- Classes Tailwind construites par concaténation.
- Dégradés, ombres portées, effets de volume dans les SVG (aplats uniquement).
- Laisser Recharts calculer le domaine de l'axe des ordonnées : les « nice values »
  élargissent le domaine et tassent la courbe. Le domaine est calculé puis **imposé**,
  avec des `ticks` à pas rond (`niceTicks`).
- Plafonner la hauteur d'un graphe : les graphes remplissent la rangée, qui remplit la
  hauteur disponible. Un plafond recrée un vide sous eux et décale le bas des colonnes.

## Terminé quand

Les graphes rendent avec un historique factice (5 ferments), la cible est en pointillés,
l'axe des ordonnées porte des graduations rondes (0,2 °C, 0,010 de densité), et `THEME.md`
documente la palette complète (anthracite, une teinte par grandeur, vert/ambre/rouge
réservés aux états, animation `bubble-rise`).
