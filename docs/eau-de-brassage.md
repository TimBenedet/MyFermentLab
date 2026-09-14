# Eau de brassage

Le calcul part du **volume fini** et remonte la rivière, perte par perte : il faut toujours
plus d'eau que de bière, et chaque litre d'écart est une perte qu'on peut nommer.

$$V_{\text{départ}} = \frac{V_{\text{final}}}{0{,}96} + V_{\text{cuve}} + D_{\text{évap}} \times t + m_{\text{grain}} \times a_{\text{BIAB}}$$

| Terme | Ce qu'il est | D'où il vient |
|---|---|---|
| **0,96** | contraction thermique | la densité de l'eau : 958,4 kg/m³ à 100 °C contre 998,2 à 20 °C, soit 3,98 %. Ce n'est pas une convention de brasseur, et 0,94 n'est pas une variante : cela correspondrait à un refroidissement depuis 125 °C |
| **D_évap** | litres par heure | la surface de la cuve et la puissance du feu — **une grandeur absolue**, qui ne se divise pas avec la recette |
| **a_BIAB** | litres par kilo de grain | le geste : 0,5 quand on presse le sac, 0,8 quand on se contente d'égoutter |

## Une seule eau, ou deux

Le modèle est celui du **BIAB** : tout le volume part en une fois dans la cuve, il n'y a donc
qu'un seul total et pas d'eau de rinçage. Un empâtage classique en demanderait deux, mais le
**total reste le même** — seul le découpage change.

| | Empâtage + rinçage | BIAB |
|---|---|---|
| Versé au départ | 13,5 L | **29,5 L** |
| Versé pendant le rinçage | 16,0 L | — |
| **Total à préparer** | **29,5 L** | **29,5 L** |

C'est pourquoi le passage au rinçage n'a d'intérêt que lorsqu'il devient **nécessaire** : quand
`eau totale + volume du grain` ne tient plus dans la cuve. À titre de repère, avec 0,8 L/kg
d'absorption et du grain à 0,65 L/kg de déplacement :

| Brassin | Eau totale | Dans la cuve | Verdict pour 45 L |
|---|---|---|---|
| 10 L | 17,0 L | 18,8 L | large |
| 20 L | 29,5 L | 33,0 L | 12 L de marge |
| 25 L | 35,8 L | 40,2 L | juste |
| 30 L | 42,1 L | 47,4 L | il faut rincer |

## Les trois réglages de la cuve, et comment les mesurer

Ces trois nombres décrivent la cuve, pas la bière : ils valent pour **toutes** les recettes et
se règlent une fois. Ils sont dans `src/lib/equipment.ts` (le magasin) et
`src/config/equipment.ts` (le catalogue de modèles).

### L'évaporation — le test à l'eau

1. Verse **15,0 L d'eau froide** dans la cuve.
2. Fais bouillir **60 min** à ton feu habituel, **sans couvercle**.
3. **Laisse refroidir**, puis mesure ce qui reste.

La différence est ton débit horaire, sans aucune correction thermique puisque les deux mesures
sont prises à la même température. Pressé, on peut lire à chaud et corriger :
`perte = 15 − 0,96 × volume_chaud`.

C'est la mesure qui rapporte le plus : c'est aussi celle qui varie le plus d'une installation à
l'autre. Un condenseur de vapeur dont on renvoie les condensats fait tomber le débit vers
0,3 L/h.

### La perte de cuve — deux morceaux

**L'espace mort**, mécanique, se mesure une fois : 2,0 L dans la cuve, on ouvre en grand
(pompe comprise) et on mesure ce qui est sorti. `espace mort = 2,0 − sorti`.

**Le trub et le houblon** se lisent sur un vrai brassin : volume à l'arrêt du feu à la règle
(`H`, à chaud), moins le volume réellement dans le fermenteur (`F`).
`perte = H × 0,96 − F`. Compte environ 0,5 L retenus par 100 g de pellets.

### L'absorption — la pesée

1. Masse de grain sèche connue : `m`.
2. Après égouttage, **avec ta technique habituelle**, on pèse le panier (ou le sac) : `M`.
3. `a = (M − m − masse_du_panier_sec) ÷ m`.

| Technique | Absorption |
|---|---|
| Sac pressé fermement | 0,4 – 0,5 L/kg |
| Sac ou panier égoutté | 0,7 – 0,8 L/kg |
| Empâtage classique | 0,8 – 1,0 L/kg |

C'est le seul réglage que le geste change — et le plus gros levier : sur 5,4 kg de grain,
0,1 L/kg d'erreur vaut 0,54 L d'eau.

## Le catalogue de modèles

`src/config/equipment.ts` publie des **fourchettes** par machine, et l'application en prend le
milieu pour remplir les champs — même principe que le référentiel d'ingrédients. Le menu
affiche « Personnalisé » dès qu'une valeur est corrigée à la main : il compare les valeurs au
lieu de stocker un identifiant, donc rien ne dérive.

| Modèle | Évaporation | Perte de cuve | Absorption |
|---|---|---|---|
| BrewZilla 35 L + extension 45 L | 2,0 – 2,5 | 0,4 – 0,8 | 0,5 – 0,8 |
| BrewZilla 35 L, sans extension | 2,0 – 2,5 | 0,4 – 0,8 | 0,5 – 0,8 |
| Marmite 25–30 L · gaz ou induction | 1,5 – 2,5 | 0,5 – 1,5 | 0,5 – 0,8 |
| Marmite 40–50 L · gaz ou induction | 3,0 – 4,0 | 0,5 – 1,5 | 0,5 – 0,8 |

Les deux BrewZilla partagent la même évaporation : la rehausse ajoute de la hauteur, pas de
surface.

## Exemples vérifiés

5,4 kg de grain, 20 L visés, 90 min d'ébullition :

| Absorption | Eau à préparer | Avant ébullition | Ratio |
|---|---|---|---|
| 0,5 (sac pressé) | **27,9 L** | 25,2 L | 5,2 L/kg |
| 0,65 (milieu) | **28,3 L** | 24,8 L | 5,2 L/kg |
| 0,8 (panier égoutté) | **29,5 L** | 25,2 L | 5,5 L/kg |

Le ratio, lui, ne se choisit pas : il découle du volume et du grain. Une cuvée plus petite
demande **plus** d'eau par litre, parce que l'évaporation, elle, ne se divise pas.

## Ce que le modèle ne fait pas

- Pas de rinçage : au-dessus de ~25 L dans une cuve de 45 L, il faudrait découper empâtage et
  rinçage — le total resterait juste, mais l'application ne le montrerait pas.
- Pas de mash-out, pas de profil d'eau, pas de pH, pas de sels : ce sont d'autres calculs, pour
  d'autres décisions.
- Pas d'OG/FG ni d'IBU : le référentiel porte les rendements et les acides alpha, mais rien ne
  les additionne encore.
