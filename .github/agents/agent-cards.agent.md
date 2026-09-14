---
description: Cartes du tableau de bord et primitives d'affichage (pastille d'état, ligne de mesure).
---

# Agent — Cartes

## Écriture

- `src/components/FermentationCard.tsx`
- `src/components/StatusDot.tsx`
- `src/components/MetricRow.tsx`

## Lecture seule

- `src/types.ts`
- `src/lib/status.ts`
- `src/lib/format.ts`
- `src/lib/reading.ts`
- `src/index.css`

## Contrat

```ts
export function FermentationCard(props: {
  reading: FermentReading;
  onOpen: (id: FermentId) => void;
}): JSX.Element;

export function StatusDot(props: { status: StatusLevel; showLabel?: boolean }): JSX.Element;
export function MetricRow(props: {
  label: string;
  children: ReactNode;
  toneClass?: string;
}): JSX.Element;
```

## Interdit

- Appeler `useFermentationFeed`, générer des données, gérer du state.
- Utiliser des classes Tailwind construites par concaténation.
- Mettre des `<div>` dans un `<button>` : la carte est un `<button>`, donc uniquement
  du contenu « phrasing » (des `<span>`).

## Terminé quand

Rend correctement dans les trois états (`ok`, `warn`, `alarm`), avec et sans humidité,
avec et sans suivi densimétrique — sans dépendre de valeurs codées en dur.

Points de vigilance :

- Le chiffre de tête est en `text-2xl` **sans mono** et **sans couleur d'état**, l'écart
  signé à droite en `text-zinc-400`.
- « non instrumentée » est une **absence** de valeur : `font-normal text-zinc-500`, pas le
  `font-medium` hérité de `MetricRow`.
- Le contexte du contenant est sur **sa propre ligne** : coincé à côté de la pastille
  d'état, il se tronque sur une carte étroite.
