> **Brief d'origine — exécuté, conservé comme archive. Ne pas le suivre.**
> Il décrit la construction initiale, pas l'état actuel : les phases qu'il donne sont
> faites, et les chemins qu'il cite (`src/lib/simulator.ts`, `src/hooks/useFerments.ts`,
> `FermentCard.tsx`, `HistoryChart.tsx`, `tailwind.config.js`) ainsi que son modèle de
> données n'ont pas été retenus tels quels.
> **Références à jour : `Prompt.md` (spécification) et `.github/copilot-instructions.md`
> (résumé opérationnel).**

# BRIEF — Dashboard de fermentation

Tu es l'agent principal. Ce fichier est ta seule source de vérité. Tu construis le projet **et** ta propre configuration d'agents. Travaille uniquement dans le dossier courant.

Déroule les phases dans l'ordre. Annonce chaque phase avant de la commencer.

---

## Phase 0 — Ta propre configuration

Crée ces fichiers avant de toucher au code applicatif.

### `.github/copilot-instructions.md`

Reprends-y les sections « Le projet », « Contrat de types », « Les quatre fermentations » et « Règles générales » de ce brief, mot pour mot. Ce fichier sera lu automatiquement à chaque requête.

### `.github/agents/agent-simulation.agent.md`

Frontmatter avec une `description` d'une ligne. Corps :

- **Écriture** : `src/lib/simulator.ts`, `src/hooks/useFerments.ts`. Rien d'autre, aucun fichier `.tsx`.
- **Lecture seule** : `src/types.ts`, `src/config/ferments.ts`
- **Contrat** : `export function useFerments(): FermentState[]`
- **Terminé quand** : le hook compile et un script de démo affiche 10 itérations plausibles

### `.github/agents/agent-cards.agent.md`

- **Écriture** : `src/components/FermentCard.tsx`, `src/components/StatusDot.tsx`
- **Lecture seule** : `src/types.ts`, `THEME.md`
- **Contrat** : `FermentCard({ state: FermentState, onClick: () => void })`
- **Interdit** : appeler `useFerments`, générer des données, gérer du state global
- **Terminé quand** : rend correctement dans les trois statuts, avec et sans humidité

### `.github/agents/agent-chart.agent.md`

- **Écriture** : `src/components/HistoryChart.tsx`, `src/styles/theme.css`, `tailwind.config.js`, `THEME.md`
- **Lecture seule** : `src/types.ts`
- **Contrat** : `HistoryChart({ history: Reading[], targetTemp: number, targetHumidity?: number })`
- **Terminé quand** : rend avec un historique factice, et `THEME.md` documente la palette

Si le frontmatter que tu écris empêche un agent de se charger, retire la clé `tools` et garde seulement `description`.

Quand ces fichiers existent, annonce-le et passe à la suite.

---

## Le projet

Page web unique de monitoring de fermentation, **données entièrement simulées**. Aucune API externe, aucun backend, aucune base de données.

Stack imposée : Vite + React + TypeScript + Tailwind + Recharts. Aucune autre dépendance sans me demander.

## Contrat de types

Écris ceci dans `src/types.ts` et n'y touche plus. C'est le seul point de synchronisation du projet.

```ts
export type FermentKind = 'beer' | 'mead' | 'koji' | 'mushroom';

export interface FermentConfig {
  id: string;
  name: string;
  kind: FermentKind;
  targetTemp: number;
  targetHumidity?: number;
}

export interface Reading {
  t: number;          // timestamp epoch ms
  temp: number;
  humidity?: number;
}

export type Status = 'ok' | 'drift' | 'alert';

export interface FermentState {
  config: FermentConfig;
  current: Reading;
  history: Reading[];   // 24 h
  status: Status;
}
```

## Les quatre fermentations

| id | nom | type | temp cible | humidité cible |
|---|---|---|---|---|
| `beer-ipa` | Bière IPA | beer | 19,5 °C | — |
| `mead` | Hydromel | mead | 18 °C | — |
| `koji` | Koji | koji | 30 °C | 75 % |
| `oyster` | Pleurotes | mushroom | 22 °C | 90 % |

Statut : `ok` si l'écart absolu à la cible ≤ 0,2 °C, `drift` jusqu'à 1 °C, `alert` au-delà.

---

## Phase 1 — Fondations

Scaffolde le projet Vite, installe les dépendances, écris `src/types.ts` et `src/config/ferments.ts`. Les installations, c'est toi et personne d'autre.

Annonce ensuite l'arborescence complète avec le propriétaire de chaque fichier.

## Phase 2 — Les trois périmètres

Traite les trois blocs ci-dessous. Si tu sais déléguer aux agents de la phase 0, délègue. Sinon, traite-les toi-même **dans l'ordre, un à la fois**, en respectant strictement le périmètre de fichiers de chacun comme s'il s'agissait d'agents distincts.

**Simulation** — génère 24 h d'historique rétroactif au montage, puis une nouvelle lecture toutes les 2 s. Courbes oscillant autour de la cible avec du bruit et une dérive lente occasionnelle qui revient vers la cible : on doit reconnaître une courbe de fermentation, pas du bruit blanc. Humidité générée seulement si `targetHumidity` existe. Historique borné à 24 h glissantes, il ne doit pas croître indéfiniment.

**Cartes** — nom, type, température actuelle en gros et en monospace, cible, écart signé (`+0,4 °C`, `−1,2 °C`), humidité si définie, et un point coloré selon le statut.

**Graphique et thème** — Recharts sur 24 h, ligne de cible en pointillés, axe temporel en heures, tooltip. Seconde courbe d'humidité sur un axe Y droit quand elle existe. Palette SCADA sombre en variables CSS exposées via Tailwind : fond anthracite, texte clair, monospace pour les valeurs, vert `ok` / ambre `drift` / rouge `alert`.

## Phase 3 — Intégration

`App.tsx` : le hook alimente une grille de cartes, le clic sur une carte ouvre le graphique en dessous. Pas de routing, écran unique.

## Phase 4 — Porte de validation

Rien n'est terminé tant que les cinq points ne passent pas. Vérifie-les toi-même, ne me demande pas de le faire.

1. `npm run build` sans erreur ni warning TypeScript
2. Zéro `any` dans le code
3. `npm run dev` démarre, l'app tourne 2 minutes sans que l'historique n'enfle indéfiniment
4. Rendu correct en colonne unique sous 640 px
5. Aucun fichier créé hors du dossier du projet

Un échec repart vers le périmètre du fichier fautif, pas ailleurs.

---

## Règles générales

- Pas de `any`
- Style SCADA industriel sombre, dense, lisible d'un coup d'œil à trois mètres. Pas d'ombres portées, pas de dégradés, pas d'arrondis excessifs.
- Aucune installation globale
- Aucun fichier hors du dossier du projet
- Si un choix technique est ambigu, tranche et signale-le en fin de phase. Ne t'arrête pas pour me demander.

## Quand tu as fini

Donne-moi la commande à lancer, la liste des fichiers créés, et les arbitrages que tu as pris seul.