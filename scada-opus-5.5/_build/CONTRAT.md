# Contrat de reconstruction — dashboard Hakko

But : reconstruire `hakko-dashboard.html` **à l'identique** depuis `README.md`.
Source normative : les annexes A (HTML), B (CSS), C (JavaScript) de `README.md`.
Elles font foi ; la prose des §1 à §10 sert de critère d'acceptation, pas de licence de réécriture.

## Règles d'or

1. **Un agent = un fichier.** Personne ne touche au fichier d'un autre, ni à `README.md`,
   ni à `hakko-dashboard.html`, ni à `_build/assemblage.py`.
2. **Transcription verbatim.** On recopie la plage de lignes demandée sans rien reformater,
   sans renommer, sans commenter, sans « corriger », sans traduire. L'indentation, les espaces,
   les guillemets et la ponctuation française sont conservés caractère pour caractère.
3. **Auto-vérification obligatoire** avant de rendre : comparer le fichier produit à la plage
   source et coller la sortie réelle de la commande.
   `cd "C:/Users/Timothée/Documents/IA/Hermes/FermentationLab2" && sed -n '424,652p' README.md | diff - _build/parts/03-style-a.css`
   Un `diff` vide est le seul résultat acceptable. Aucune sortie inventée.
4. **Interdits** : navigateur, `node`, `npm`, `python`, `git`, tout fichier hors de la plage assignée.

## Partition (fichiers et plages, cf. `_build/PARTITIONS.md`)

| Fichier | README lignes | Nb |
|---|---|---|
| `_build/parts/01-head.html` | 410–420 | 11 |
| `_build/parts/02-body.html` | 379–402 | 24 |
| `_build/parts/03-style-a.css` | 424–652 | 229 |
| `_build/parts/03-style-b.css` | 654–905 | 252 |
| `_build/parts/04-script-a.js` | 911–1188 | 278 |
| `_build/parts/04-script-b.js` | 1190–1445 | 256 |
| `_build/parts/04-script-c.js` | 1447–1698 | 252 |
| `_build/parts/04-script-d.js` | 1700–1975 | 276 |
| **total** | | **1578** |

Les lignes vides situées aux jointures (653, 1189, 1446, 1699) ne sont dans aucune part :
l'assemblage les restitue.

## Assemblage (fait par le parent, `_build/assemblage.py`)

```
01-head.html (moins la ligne de l'élément style placeholder)
  → élément style encadrant 03-style-a.css + 03-style-b.css
  → fin de l'en-tête
02-body.html (commence par l'ouverture du corps du document)
  → ouverture de l'élément script
  → 04-script-a.js + 04-script-b.js + 04-script-c.js + 04-script-d.js
  → fermetures script / corps / document
```

Puis contrôle : `diff _verify/reference-original.html hakko-dashboard.html` doit être **vide**.

## Critères d'acceptation (§10 du README)

1. Les 4 pages principales et les 4 sous-pages s'affichent sans erreur console, en clair comme en sombre.
2. Vue d'ensemble, Détail et Fiche d'archive tiennent sans scroll en 1440 × 860 et en 1280 × 720.
3. Les valeurs en direct changent toutes les 3 s sans perdre le focus ni la position de scroll.
4. Un changement de consigne produit une entrée « Consigne » puis une entrée de chauffe.
5. Un relevé de densité daté dans le passé se place à cette date (graphique et tableau).
6. « Terminer le lot » retire le lot de l'accueil et ouvre sa fiche d'archive en lecture seule.
7. Les 5 prises affichent un bouton ON vert / OFF rouge qui bascule au clic.
8. L'état est conservé après rechargement (`localStorage`).

Invariants de mise en page (§9) : pages « un seul écran » sans défilement au-delà de 1101 px de large
et 640 px de haut ; barre latérale masquée sous 900 px ; seuls les blocs `.scroll` défilent.
