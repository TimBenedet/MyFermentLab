# Brief — moderniser le design du dashboard Hakko (maquette d'essai)

Tu interviens comme **designer front-end**. Ta mission a deux parties, dans cet ordre :
**1) une revue** du dashboard existant, **2) une maquette d'essai** qui en propose une version
modernisée. Tu ne touches à rien d'existant (voir « Interdits »).

---

## 1. Le contexte réel

`scada-opus-5.5/hakko-dashboard.html` est le tableau de bord d'un **laboratoire de fermentation
domestique** (bière, miso, koji, garum). Il est :

- **un seul fichier HTML** (≈ 1 950 lignes : un `<style>`, deux `<script>` en ligne, des SVG) ;
- **servi par un cluster k3s** (nginx dans un pod), derrière un pont qui parle à Home Assistant ;
- **piloté par de vraies données** : 3 sondes de température (21,3 / 21,4 / 26,9 °C), une sonde
  d'humidité (56,9 %), 5 prises connectées pilotables (`switch.smart_switch_…_outlet_1..5`),
  4 lots en cours/archivés, 6 recettes, un journal d'événements ;
- **utilisé par une seule personne**, souvent **debout dans une cuisine ou un garage**, souvent
  **sur son iPhone** (une vue téléphone a été ajoutée le même jour : sous 900 px de large, la
  colonne latérale disparaît, une barre d'onglets basse apparaît, les cibles passent à 44 px).

Ce qu'il fait déjà bien, et qu'il ne faut pas perdre : thème clair / sombre / auto,
`:focus-visible` global, `font-variant-numeric: tabular-nums` sur les chiffres,
`env(safe-area-inset-*)` pour l'encoche, barre supérieure en verre dépoli, cibles tactiles de
44 px en mobile.

## 2. Inventaire du design actuel (mesuré, pas estimé)

```
Jetons (thème clair) :
  --bg #F4F5F7   --surface #FFFFFF   --surface2 #F7F8FA   --hover #F1F3F6
  --ink #111827  --ink2 #374151      --muted #6B7280      --faint #9CA3AF
  --line #E5E7EB --line2 #D1D5DB     --grid #EEF0F3
  --accent #2350B8   --accent-soft #EAF0FC
  --ok #15803D  --warn #B45309  --bad #B91C1C   (+ fonds --ok-bg, --warn-bg, --bad-bg)
  --biere #C98410  --miso #95602F  --koji #5A8A2E  --garum #9B2C4A
  --side #151A21   --side-ink #AEB6C2  --side-active #232A34  --side-line #262D38
  --shadow 0 1px 2px rgba(16,24,40,.05)
Jetons (thème sombre) : --bg #0E1116, --surface #161A21, --accent #7FA2EC, --side #0A0C10,
  --shadow none
Typographie : IBM Plex Sans 400/500/600, base 14 px / interligne 1,5 ; titres de page 22 px ;
  titres de carte 14 px ; marque 15 px. Chiffres en tabular-nums.
Rayons : 5 px (badges), 6 px (liens de nav), 7 px (boutons, champs, marque), 10 px (cartes)
Structure : .app = grille 236 px + contenu · .side (colonne sombre, nav + pied) ·
  .topbar en verre (60 px) · .content · .ph (titre + actions) · .card primitives ·
  .badge (ok/warn/bad) · .btn (défaut / primary / ghost / danger / sm) · champs 36 px ·
  graphiques SVG dessinés à la main · tableaux .data · boîtes <dialog>
Interactions : bascule du thème, bascule « vue téléphone », interrupteurs de prises,
  onglets de filtre, choix de période des graphiques, formulaires de note / densité / consigne
```

## 3. La revue (partie 1)

Applique les **règles Vercel « Web Interface Guidelines »** au fichier existant. Récupère-les
d'abord, à jour, ici :

```
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

Puis rends tes constats au format demandé par ce document (`chemin:ligne - problème`, terse,
groupé par fichier). Trois défauts déjà mesurés de mon côté — confirme-les ou corrige-les, et
cherche les autres :

- lignes **252** et **357** : les champs posent `outline:none` **sans anneau de remplacement**
  (le `:focus-visible` global de la ligne 76 vise les liens et boutons, pas les champs) ;
- **aucun** `prefers-reduced-motion` dans le fichier, alors qu'il y a des transitions ;
- **pas de** `<meta name="theme-color">`, alors que le thème clair/sombre existe.

Écris la revue dans **`design/revue-actuelle.md`**.

## 4. La maquette d'essai (partie 2)

Écris **`design/maquette-hakko.html`** : un fichier HTML autonome, **ouvrable directement**
(double-clic / `file://`), qui montre la même application avec un design modernisé.

**Méthode imposée par la compétence design** — applique-la et dis-le dans tes notes :

- **Choisis UNE direction esthétique tranchée** et nomme-la en tête de fichier (commentaire
  CSS). Public : une personne seule, dans une cuisine, sur un téléphone, qui lit des
  températures et l'état de prises. Une maquette timide ne sert à rien.
- **Un élément mémorable**, et il doit porter une **donnée** (pas de la décoration) : fais de la
  température et/ou de la progression d'un lot la signature visuelle.
- **Typographie** : au plus **deux familles**, chargées par Google Fonts avec `display=swap` et
  un repli système complet (la page actuelle charge IBM Plex Sans — tu peux la garder, la
  remplacer, ou l'associer ; IBM Plex Mono/Serif sont disponibles chez Google Fonts). Inter,
  Roboto, Arial et la pile système seule sont exclus.
- **Couleurs** : dominante + accent franc (règle 70/20/10). Le sens du produit doit rester
  lisible : température = chaud, ok/alerte = vert/orange/rouge, types de fermentation déjà
  codés (`--biere`, `--miso`, `--koji`, `--garum`). Ne détruis pas ces conventions, modernise-les.
- **Fond avec de l'atmosphère**, pas un aplat gris.
- **Mouvement orchestré** : une arrivée de page soignée vaut mieux que dix micro-animations ;
  durées 200–400 ms ; n'anime que `transform` et `opacity` ; **honore
  `prefers-reduced-motion`** ; jamais `transition: all`.
- **Accessibilité** : contraste ≥ 4,5:1 pour le texte et ≥ 3:1 pour les éléments d'interface,
  anneaux de focus visibles sur **tous** les éléments interactifs (champs compris), HTML
  sémantique, `aria-label` sur les boutons icône, `aria-live` sur ce qui se met à jour seul.

**Le contenu de la maquette doit être la vraie application**, pas un squelette : les mêmes
sections (vue d'ensemble avec ses indicateurs et ses cartes de lots, appareils, recettes,
archive, journal), les mêmes intitulés en français, les mêmes chiffres que le fichier réel, les
mêmes états (un lot échu, un lot sans sonde, une prise allumée, une alerte, une donnée
manquante). Invente le strict minimum de données de démonstration, en gardant les valeurs
réelles ci-dessus.

**Mobile** : reprends le comportement existant sans le dégrader — sous 900 px, la colonne
latérale laisse place à une barre d'onglets basse, les cibles font au moins 44 × 44 px (zone
réellement touchable comprise), les champs font au moins 16 px de corps (Safari iOS zoome en
dessous), et `env(safe-area-inset-*)` est respecté.

## 5. Interdits

- **Ne modifie AUCUN fichier existant.** `scada-opus-5.5/hakko-dashboard.html` est en production :
  tu peux le **lire**, jamais l'écrire. N'y touche pas, même pour un commentaire.
- **Aucune dépendance nouvelle, aucune compilation, aucun paquet** : pas de React, pas de
  Tailwind, pas de `npm install`, pas de CDN de bibliothèque. Un seul fichier HTML, CSS et
  JavaScript natifs. La seule ressource externe autorisée est Google Fonts (la page actuelle
  s'en sert déjà).
- N'introduis pas de changement de données ou de comportement : c'est un travail de **design**.
- Ne construis pas deux maquettes. Une seule, assumée ; si tu vois une seconde direction
  pertinente, décris-la en trois lignes dans tes notes au lieu de la coder.

## 6. Ce que tu livres

| Fichier | Contenu |
|---|---|
| `design/revue-actuelle.md` | la revue Vercel, format `chemin:ligne`, groupée par fichier |
| `design/maquette-hakko.html` | la maquette modernisée, autonome |
| `design/maquette-notes.md` | la direction choisie et pourquoi · ce que tu as changé · la seconde direction en trois lignes · ce qui **n'est pas** traité · les mesures que tu as faites |

Écris en **français**, y compris les commentaires de code. Dans `maquette-notes.md`, ne
prétends pas avoir vérifié ce que tu n'as pas mesuré : si tu n'as pas pu ouvrir la page dans un
navigateur, dis-le.
