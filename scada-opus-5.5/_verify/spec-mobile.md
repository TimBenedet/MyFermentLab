# Spécification mobile — `hakko-dashboard.html`

Statut : **normative**. Tout ce qui est écrit en bloc de code est à recopier tel quel ;
les numéros de ligne renvoient au fichier actuel (1783 lignes, commit `0426676`).
Aucune règle ci-dessous ne modifie une règle existante : tout est ajouté, et tout est
conditionnel (classe sur `html` ou `@media`). La seule entorse au rendu du bureau est le
bouton « Vue téléphone » lui-même, décidé par l'utilisateur (voir §10, point 1).

Critères mesurables : `spec-acceptation.md`.

---

## 0. Résumé

| # | Correctif | Où | Pourquoi |
|---|---|---|---|
| 1 | Vue d'ensemble à une colonne | bloc B1 | la règle `≤ 1360 px` (l. 492) écrase la règle `≤ 1180 px` (l. 490) : colonne des lots de **84 px** à 430 px |
| 2 | Onglets de filtre sans débordement | bloc B2 | 4 onglets demandent ≈ 445 px pour 396 px disponibles |
| 3 | Interrupteur 56 × 32, cible 56 × 44 | bloc B3 | décision utilisateur |
| 4 | Autres cibles ≥ 44 px | bloc B4 | icônes 34, boutons 30/36, sélecteurs 30/32, filtres 30, pas-à-pas 36/40, fil d'Ariane 21 |
| 5 | Champs en 16 px | bloc B5 | sous 16 px, Safari iOS zoome la page à la prise de focus |
| 6 | Journal du lot lisible | bloc B6 | à ≤ 640 px le texte du journal tient dans une colonne de **80 px** (l. 426 écrase l. 405-408) |
| 7 | Vue forcée = téléphone de 430 px | bloc A | recopie des 9 conditions `@media` en jeu, plus neutralisation du verrou de hauteur |
| 8 | Marges de sécurité latérales, double marge basse | bloc C | `safe-area-inset-left/right` non gérés ; `env(bottom)` compté deux fois |

---

## 1. Composition : deux classes, trois blocs

### 1.1 Les deux classes

| Classe sur `<html>` | Posée quand | Porte |
|---|---|---|
| `vue-tel` | **seulement** quand l'utilisateur a enfoncé « Vue téléphone » | le cadre de 430 px et la recopie des `@media` existants (bloc A) |
| `tactile` | largeur ≤ 900 px **ou** vue forcée | les règles nouvelles : grille, onglets, interrupteur, cibles, champs, journal (bloc B) |

Les règles du bloc B sont écrites **une seule fois**, sous `html:is(.tactile,.vue-tel)`.
Le `:is()` rend la classe `vue-tel` suffisante à elle seule. Le banc existant
`verifie-mobile.mjs` ne pose que `vue-tel`, et un défaut du script ne doit pas désarmer
les cibles en vue forcée.

Le bloc A reproduit le comportement des `@media` existants, qui restent inchangés. Il
n'est vrai qu'en vue forcée. Il contient la **valeur nette à 430 px**, après cascade, et
non une copie aveugle de chaque bloc.

### 1.2 Pourquoi pas une recopie préfixée (ce qui « double » vraiment)

En CSS, une déclaration identique présente à la fois dans un `@media` et sous une classe
ne s'additionne pas : la seconde remplace la première, avec la même valeur. Ce qui
produit un double effet, ou un effet différent, ce sont trois mécanismes précis, tous
présents ici :

1. **La hausse de spécificité.** Préfixer par `html.vue-tel ` ajoute (0,1,1). La copie
   peut alors battre une règle contre laquelle l'original **perdait**, et la vue forcée
   diverge du vrai téléphone. C'est le cas de trois règles du fichier, que
   l'outil `outils/decoupe-vue-telephone.py` recopierait telles quelles :
   - `.rrow,.rows-h{…96px 34px}` (≤ 640) perd contre `.rrow.step` (0,2,0). Recopiée à
     (0,2,1), elle gagne et casse les lignes d'étapes du formulaire de recette (le
     numéro passe dans la colonne large, le champ dans 96 px) ;
   - `.grav-form{grid-template-columns:1fr}` (≤ 640) perd contre `.grav-side .grav-form`
     (l. 417). Recopiée, elle gagne et change le formulaire de densité ;
   - `.journal li.jl{…}` (l. 406) perd par ordre de source contre la l. 426. Recopiée,
     elle gagne : la vue forcée « répare » un défaut que le vrai téléphone garde.
2. **Une copie de palier large qui écrase un palier étroit.** Recopier sous une classe
   posée à toute largeur ≤ 900 la règle `≤ 1250 px` (`.outlets` à 3 colonnes) la ferait
   gagner, à 375 px, sur la règle native `≤ 440 px` (1 colonne). D'où la séparation :
   `vue-tel` n'est posée qu'en vue forcée, et elle porte la valeur nette d'un cadre de
   430 px, qui est fixe.
3. **Les quantités additives.** `env(safe-area-inset-bottom)` est déjà compté deux fois
   dans le fichier : `:root{padding-bottom:env(…)}` (l. 23) et
   `.content{padding-bottom:calc(84px + env(…))}` (l. 95). Le bloc C le retire de
   `:root` sous 900 px. Pour la même raison, l'interrupteur est agrandi par
   `width/height`, jamais par `transform:scale()`, qui se composerait avec la
   translation de la pastille.

### 1.3 Ordre et spécificité

Les trois blocs sont insérés **à la fin du `<style>`**, dans l'ordre A, B, C, entre la
l. 492 et `</style>` (l. 493). Spécificités minimales obtenues :

- bloc A : `html.vue-tel .x`, soit (0,2,1). Ce niveau bat toutes les règles des `@media`
  existants que le bloc doit remplacer, notamment `.content[data-page="detail"]` (0,2,0)
  de la l. 389 ;
- bloc B : `html:is(.tactile,.vue-tel) .x`, soit (0,2,1) au minimum. Les cas où une
  règle existante est plus forte sont traités un par un ci-dessous (colonne
  « contre qui ») ;
- bloc C : spécificité ordinaire, **sous `@media (max-width:900px)`**. Il gagne par
  l'ordre de source sur le bloc `≤ 900` d'origine (l. 89-100), et perd volontairement
  contre le bloc A.

---

## 2. Mécanisme : HTML et JS

La vue forcée ne recharge rien, n'ouvre aucune page et ne touche ni à `S`, ni à
`tick()`, ni à la régulation : elle ne fait que poser des classes. La logique des prises
reste donc unique **dans la page** (voir toutefois §9.1 pour le cas de deux navigateurs).

**2.1 Script de tête**, inséré entre la l. 9 (`<link … fonts>`) et la l. 10 (`<style>`).
Posé avant la feuille de style, il fait que la première image est déjà la bonne, sans
saut de mise en page :

```html
<script>
/* ---------- Vue téléphone ----------
   « vue-tel » : présentation téléphone forcée par le bouton (cadre de 430 px).
   « tactile » : cibles et champs agrandis, sous 900 px ou en vue forcée.
   Posées ici, avant la feuille de style, pour que la première image soit la bonne. */
const VUE_CLE = 'hakko-vue';
const vueEtroite = matchMedia('(max-width: 900px)');
let vueForcee = false; try { vueForcee = localStorage.getItem(VUE_CLE) === 'tel'; } catch(e) {}
function appliquerVue(){
  const h = document.documentElement;
  h.classList.toggle('vue-tel', vueForcee);
  h.classList.toggle('tactile', vueForcee || vueEtroite.matches);
  const b = document.getElementById('vueBtn');
  if (b) b.setAttribute('aria-pressed', vueForcee ? 'true' : 'false');
}
function basculerVue(){
  vueForcee = !vueForcee;
  try { if (vueForcee) localStorage.setItem(VUE_CLE, 'tel'); else localStorage.removeItem(VUE_CLE); } catch(e) {}
  appliquerVue();
}
vueEtroite.addEventListener('change', appliquerVue);
appliquerVue();
</script>
```

La clé `hakko-vue` suit la convention de `hakko-theme` (l. 1763). Les graphiques se
redessinent seuls au changement de largeur, grâce au `ResizeObserver` de la l. 787.

**2.2 Bouton**, inséré l. 511, **avant** le bouton de thème, pour que ce dernier garde
sa position au bord droit :

```html
        <button class="icon-btn" data-action="vue" id="vueBtn" aria-pressed="false" aria-label="Vue téléphone" title="Vue téléphone"></button>
```

Le libellé reste constant : c'est `aria-pressed` qui dit l'état, comme pour tout bouton
bascule.

**2.3 Icône**, ajoutée dans le `Object.assign(IC, {…})` (l. 865-885) :

```js
  tel: svgI('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),
```

**2.4 Clic**, ajouté l. 1668, juste après la ligne `theme` :

```js
  if (act === 'vue') return basculerVue();
```

**2.5 Démarrage**, ajouté après `applyTheme();` (l. 1773) :

```js
document.getElementById('vueBtn').innerHTML = IC.tel;
appliquerVue();
```

---

## 3. Bloc A — `html.vue-tel` : un téléphone de 430 px à n'importe quelle largeur

Pourquoi 430 px : c'est la largeur en points CSS de l'iPhone 15 Pro Max en portrait. La
vue forcée à 1440 px reproduit donc exactement l'appareil mesuré, ce qui permet de la
comparer au vrai téléphone (critère 17 de l'acceptation). Pourquoi un cadre plutôt que
toute la largeur : les grilles en `auto-fill` (`.kpis`, `.lots`) et toutes les règles
`≤ 1250 / 1180 / 1100 / 760 / 640 / 440 px` réagissent à la **fenêtre**. À 1440 px
sans cadre, on obtiendrait un hybride : 8 indicateurs par ligne, 5 lots de front, le
détail à 3 colonnes. Ce choix est ouvert à discussion (§10, point 2).

```css
/* ===== Vue téléphone forcée (bouton) : cadre de 430 px et recopie des @media =====
   Chaque règle porte la valeur NETTE qu'obtient une fenêtre de 430 px après cascade.
   Rien ici ne s'applique sans la classe vue-tel. */
html.vue-tel{--cadre-tel:430px}
html.vue-tel body{max-width:var(--cadre-tel);margin:0 auto;box-shadow:0 0 0 1px var(--line)}
html.vue-tel dialog{width:min(calc(var(--cadre-tel) - 32px),calc(100vw - 32px))}

/* recopie de @media (max-width:900px), l. 89-100 : coquille */
html.vue-tel .app{grid-template-columns:1fr}
html.vue-tel .side{display:none}
html.vue-tel .topbar{padding:0 16px}
html.vue-tel .m-brand{display:grid}
html.vue-tel .sync-txt{display:none}
html.vue-tel .content{padding:20px 16px calc(84px + env(safe-area-inset-bottom,0px))}
html.vue-tel .tabbar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:20;max-width:var(--cadre-tel);margin:0 auto;background:var(--surface);border-top:1px solid var(--line);padding:6px 8px calc(6px + env(safe-area-inset-bottom,0px))}
html.vue-tel .tabbar a{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 0;color:var(--muted);font-size:11.5px;font-weight:500}
html.vue-tel .tabbar a svg{width:20px;height:20px}
html.vue-tel .tabbar a[aria-current="page"]{color:var(--accent)}

/* recopie de @media (max-width:900px), l. 209-218 : tableaux en fiches */
html.vue-tel table.data.stack thead{display:none}
html.vue-tel table.data.stack,html.vue-tel table.data.stack tbody,html.vue-tel table.data.stack tr{display:block}
html.vue-tel table.data.stack tr{padding:12px 16px;border-bottom:1px solid var(--line)}
html.vue-tel table.data.stack tr:last-child{border-bottom:0}
html.vue-tel table.data.stack td{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:4px 0;border:0;text-align:right}
html.vue-tel table.data.stack td[data-l]::before{content:attr(data-l);color:var(--muted);font-size:12.5px;text-align:left}
html.vue-tel table.data.stack td.first{justify-content:flex-start;text-align:left;padding-bottom:8px}
html.vue-tel table.data.stack .ctl{justify-content:flex-end}

/* recopie de @media (max-width:1180px), l. 184 et l. 490 */
html.vue-tel .ov{grid-template-columns:1fr}
html.vue-tel .home .feed-card{max-height:360px}
html.vue-tel .home .lots.scroll{overflow:visible}

/* recopie de @media (max-width:1100px), l. 306, 393-404, 421, 434 */
html.vue-tel .rf{grid-template-columns:1fr}
html.vue-tel .sticky{position:static}
html.vue-tel .dp-grid{grid-template-columns:1fr;grid-template-rows:none}
html.vue-tel .dp-chart,html.vue-tel .dp-journal,html.vue-tel .dp-devs,html.vue-tel .dp-side{grid-column:auto;grid-row:auto}
html.vue-tel .dp-chart{height:380px}
html.vue-tel .dp-journal{height:420px}
html.vue-tel .dp-side>.dp-params{flex:none}
html.vue-tel .dp-chart-body.with-side{flex-direction:column}
html.vue-tel .dp-chart.dp-chart:has(.with-side){height:auto}
html.vue-tel .dp-chart-body.with-side .dp-plot{height:260px;flex:none}
html.vue-tel .grav-side{width:auto;border-left:0;padding-left:0}
html.vue-tel .grav-list{max-height:240px}
html.vue-tel .dp-grid.arch .arch-2{height:320px}
html.vue-tel .dp-grid.arch .dp-devs{height:360px}

/* recopie de ≤ 1250 (3 col.), ≤ 760 (2 col.), ≤ 440 (1 col.) : valeur nette à 430 px */
html.vue-tel .outlets{grid-template-columns:1fr}

/* recopie de @media (max-width:640px) : seulement ce qui est vivant à 430 px */
html.vue-tel .fgrid{grid-template-columns:1fr}
html.vue-tel .types{grid-template-columns:1fr 1fr}
html.vue-tel .rrow:not(.step),html.vue-tel .rows-h{grid-template-columns:minmax(0,1fr) 96px 34px}
html.vue-tel .journal li.jl time{grid-column:1/-1}

/* neutralisation de @media (min-width:1101px) and (min-height:640px), l. 388-392 et 487-489 :
   à 1440 × 900 ce verrou fixerait .dp à la hauteur de la fenêtre */
html.vue-tel .dp{height:auto;min-height:0;display:block}

/* bouton enfoncé */
html.vue-tel #vueBtn{background:var(--accent-soft);border-color:var(--accent);color:var(--accent)}
```

Règles volontairement **non recopiées**, avec la raison :

| Règle d'origine | Raison |
|---|---|
| `.dgrid`, `.d3` (l. 283-284), `.d2` (l. 316) | aucune classe de ce nom n'est émise par le script : règles mortes |
| `.grav-form{1fr}` (l. 334) | morte à 430 px : `.grav-side .grav-form` (l. 417) l'emporte, et tout `.grav-form` est dans `.grav-side` |
| `.journal li.jl{auto 1fr;row-gap:4px}` (l. 406) | morte : la l. 426 (même spécificité, plus loin) l'emporte. Seul `time{grid-column:1/-1}` est vivant et recopié |
| `.home-grid{…300px}` (l. 492) | c'est le défaut à corriger ; le bloc B1 le remplace pour les deux classes |
| `.dp-grid{flex:1;min-height:0}`, `.home.dp .home-grid{…}` | inertes dès que `.dp` n'est plus un conteneur flex |

`.content[data-page="detail"]` (l. 389, (0,2,0)) est battue par `html.vue-tel .content`
(0,2,1) : la marge basse de 84 px, qui laisse la place de la barre d'onglets, est donc
rétablie sur les pages de détail.

---

## 4. Bloc B — règles tactiles, écrites une seule fois

```css
/* ===== Tactile : téléphone (≤ 900 px, classe posée par le script) ou vue forcée ===== */
html:is(.tactile,.vue-tel){--cible:44px;--police-champ:16px}
```

`--cible` = 44 px : c'est le minimum des recommandations d'Apple pour les interfaces
(44 × 44 pt) et le seuil AAA des WCAG (critère 2.5.5). `--police-champ` = 16 px : c'est
le seuil sous lequel Safari iOS zoome la page quand un champ prend le focus.

### B1 — Vue d'ensemble à une colonne

```css
html:is(.tactile,.vue-tel) .home-grid{grid-template-columns:minmax(0,1fr)}
html:is(.tactile,.vue-tel) .home .lots{grid-template-columns:repeat(auto-fill,minmax(min(250px,100%),1fr))}
```

- Contre qui : `@media (max-width:1360px){.home-grid{minmax(0,1fr) 300px}}` (0,1,0). Il
  est battu par spécificité, sans dépendre de l'ordre, alors que c'est justement l'ordre
  qui a créé le défaut.
- `minmax(0,1fr)` et non `1fr` : `1fr` vaut `minmax(auto,1fr)`, et la largeur minimale
  d'une carte pourrait alors élargir la piste. `0` garantit l'absence de débordement.
- `min(250px,100%)` : à 430 px, la colonne unique des lots fait 372 px, et rien ne
  change. Sous 302 px de fenêtre (Galaxy Fold replié : 280), 250 px ne tiennent plus, et
  le débordement serait **invisible**, découpé par `.scroll-card{overflow:hidden}`,
  exactement comme le défaut actuel.
- Contre `.home .lots` (0,2,0) : (0,3,1).

### B2 — Onglets de filtre qui ne débordent plus

Besoin mesuré sur la capture (IBM Plex Sans 14 px, 500) : textes 29 + 81,5 + 58 + 38 =
206,5 px ; pastilles de compte ≈ 20 px chacune. Avec les réglages ci-dessous :
206,5 + 4 × 16 (marges intérieures) + 4 × (4 + 20) (pastilles) + 8 = **374,5 px** pour
**396 px** disponibles à 430 px. Les 4 onglets tiennent, avec 21 px de reste répartis
par `flex-grow`. Sous environ 410 px de fenêtre (iPhone 15 : 390, Android : 360), ils
ne tiennent plus. La barre défile alors latéralement, **dans la carte**, sans jamais
faire déborder la page.

```css
html:is(.tactile,.vue-tel) .tabs{gap:0;padding:0 4px;overflow-x:auto;overflow-y:hidden;border-bottom:0;box-shadow:inset 0 -1px 0 var(--line);scrollbar-width:none}
html:is(.tactile,.vue-tel) .tabs::-webkit-scrollbar{display:none}
html:is(.tactile,.vue-tel) .tabs>button{flex:1 0 auto;height:auto;min-height:var(--cible);align-self:stretch;padding:0 8px;margin-bottom:0;white-space:nowrap}
html:is(.tactile,.vue-tel) .tabs .cnt{margin-left:4px}
```

- Le filet passe de `border-bottom` à une ombre intérieure, `inset 0 -1px 0 var(--line)`.
  Un conteneur qui défile découpe à sa boîte intérieure, donc le `margin-bottom:-1px` des
  boutons (l. 133), qui faisait chevaucher le soulignement de 2 px sur la bordure,
  perdrait 1 px. L'ombre intérieure est peinte sous les enfants : le soulignement
  `var(--accent)` de l'onglet actif la recouvre, sans changement visuel.
- `.tabs>button` (enfants directs) et non `.tabs button`, pour ne pas toucher aux
  boutons du `.seg` logé dans les onglets du graphique (l. 1283).
- `align-self:stretch` : quand un `.seg` de 46 px (44 + bordures) est présent, les
  onglets prennent 46 px et leur soulignement reste collé au filet.
- Contre qui : `.dp-chart .tabs button{height:42px}` (0,2,1) < (0,2,2) ; `.tabs .cnt`
  (0,2,0) < (0,3,1).
- S'applique aussi aux onglets des Recettes (2 onglets, qui prennent chacun la moitié) et
  du graphique de détail (≈ 324 px nécessaires, tient à 430 px).

### B3 — Interrupteur des prises : 56 × 32 visibles, zone tactile 56 × 44

```css
html:is(.tactile,.vue-tel) .switch{width:56px;height:32px}
html:is(.tactile,.vue-tel) .switch::after{width:28px;height:28px}
html:is(.tactile,.vue-tel) .switch[aria-checked="true"]::after{transform:translateX(24px)}
html:is(.tactile,.vue-tel) .switch::before{content:"";position:absolute;left:0;right:0;top:calc((32px - var(--cible)) / 2);bottom:calc((32px - var(--cible)) / 2)}
html:is(.tactile,.vue-tel) .ctl{gap:16px}
```

- Pastille : 28 = 32 − 2 × 2. La marge de 2 px (l. 205, `top:2px;left:2px`) est
  conservée. Course : 24 = 56 − 28 − 2 × 2.
- La zone tactile est portée par **`::before`**, parce que `::after` porte déjà la
  pastille. Elle déborde de 6 px au-dessus et au-dessous : 32 + 12 = 44. Elle est
  transparente et sans `border-radius`, car les navigateurs tiennent compte des coins
  arrondis pour savoir où tombe le doigt. Elle est peinte avant `::after`, donc sous la
  pastille. `.switch` est déjà `position:relative` (l. 204). Le toucher sur la zone
  appartient au bouton, donc `closest('[data-action]')` trouve bien `toggle-plug`.
- `.ctl{gap:16px}` : dans la fiche d'un appareil, l'interrupteur, qui commande une vraie
  prise, est voisin du bouton × « Retirer » (`rm-dev`). Avec la zone de 5 px du × (B4),
  il reste **11 px** libres entre les deux cibles, contre 8 px au mieux aujourd'hui.
  Largeur à 360 px : libellé « Contrôle » ≈ 55 + 12 + sélecteur ≈ 94 (en 16 px) + 16 +
  56 + 16 + 34 = 283 px pour 294 px disponibles.
- Contre qui : `.switch[aria-checked="true"]::after` (0,2,1) < (0,3,2) ; `.ctl` (0,1,0).
- Couleurs inchangées : fond `var(--line2)`, allumé `var(--ok)`, pastille `#fff`
  (littéral du fichier, l. 205, qui n'est pas un token).

### B4 — Les autres cibles sous 44 px

Principe : **pseudo-élément** quand l'ancêtre ne découpe pas et que l'élément accepte un
pseudo-élément, pour ne rien changer à la mise en page. Sinon, **hauteur réelle**.
`<input>` et `<select>` n'ont pas de `::before`, et `.seg` comme `.stepper` sont en
`overflow:hidden` (l. 137, l. 324).

| Élément | Aujourd'hui | Décision | Moyen |
|---|---|---|---|
| `.icon-btn` (thème, vue, × des appareils, des relevés et des lignes de recette, fermer la boîte de dialogue) | 34 × 34 | 44 × 44 | `::before` à −5 px, sans changer la mise en page (la colonne de 34 px de `.rrow` reste valable) |
| `.m-brand` (lien Accueil de la barre du haut) | 28 × 28 | 44 × 44 | `::before` à −8 px |
| `.btn` (sauf `.sm`) | h 36 | h 44 visible | hauteur réelle, alignée sur les champs de 44 qu'il côtoie (`.note-form`, `.tset`) |
| `.btn.sm` (les 5 emplois sont tous `ghost`, l. 1221, 1225, 1298, 1418, 1421) | h 30 | h 44 | `::before` à −7 px en hauteur ; bouton sans fond, donc aucun changement visuel, et l'en-tête de carte garde sa hauteur |
| `.seg button` (types de recette et d'archive, filtre du journal, période du graphique) | h 30 (42 dans le graphique) | h 44 visible | hauteur réelle (`.seg` découpe) |
| `input`, `select` (dont `table.data select` 30, `.o-f select` 32) | h 30 à 36 | h 44 visible | hauteur réelle (pas de pseudo-élément possible) |
| `.stepper button` (consigne −/+) | 40 × 40, 36 dans `.dp-side` | 44 × 44 | réel (`.stepper` découpe) |
| `.crumbs a` (fil d'Ariane des pages de détail) | h 21 | h 44 | réel, `min-height` ; tient dans la barre de 60 px ; `.crumbs` découpe, donc pas de pseudo-élément |
| `.tabs>button` | h 44 | inchangé | déjà conforme |
| `.tabbar a` | ≈ 103 × 51 | inchangé | déjà conforme |
| `.o-btn`, `.types span`, `.lot`, `tr.click` | ≥ 44 | inchangé | déjà conformes |
| lien « Recette » dans `.kv dd` (paramètres du lot) | h 21 | **exempté** | lien en ligne dans une liste de valeurs (exemption « en ligne » des WCAG, critère 2.5.8) ; la recette reste joignable par l'onglet Recettes |

```css
html:is(.tactile,.vue-tel) .icon-btn{position:relative}
html:is(.tactile,.vue-tel) .icon-btn::before{content:"";position:absolute;inset:calc((34px - var(--cible)) / 2)}
html:is(.tactile,.vue-tel) .m-brand{position:relative}
html:is(.tactile,.vue-tel) .m-brand::before{content:"";position:absolute;inset:calc((28px - var(--cible)) / 2)}
html:is(.tactile,.vue-tel) .btn:not(.sm){height:var(--cible)}
html:is(.tactile,.vue-tel) .btn.sm{position:relative}
html:is(.tactile,.vue-tel) .btn.sm::before{content:"";position:absolute;left:0;right:0;top:calc((30px - var(--cible)) / 2);bottom:calc((30px - var(--cible)) / 2)}
html:is(.tactile,.vue-tel) .seg button{height:var(--cible)}
html:is(.tactile,.vue-tel) .stepper button{width:var(--cible);height:var(--cible)}
html:is(.tactile,.vue-tel) .crumbs a{display:inline-flex;align-items:center;min-height:var(--cible)}
```

- `.btn:not(.sm)` et non `.btn` : `html:is() .btn` (0,2,1) battrait `.btn.sm{height:30px}`
  (0,2,0) et agrandirait visiblement les boutons des en-têtes de carte.
- Contre qui : `.seg button` (0,1,1) et `.dp-chart .tabs button` (0,2,1) < (0,2,2) ;
  `.dp-side .stepper button` (0,2,1) < (0,2,2).
- Chevauchements vérifiés : une zone de −5 px dans un écart de 8 px (`.rrow`) ne touche
  pas le champ voisin. Les `.btn` empilés (`.ph-actions`, carte « Actions ») sont
  espacés de 8 px, et leur hauteur réelle ne crée aucune zone débordante.

### B5 — Champs en 16 px, 44 px de haut

```css
html:is(.tactile,.vue-tel) :is(input[type=text],input[type=number],input[type=search],input[type=datetime-local],select){height:var(--cible)}
html:is(.tactile,.vue-tel) :is(input[type=text],input[type=number],input[type=search],input[type=datetime-local],select,textarea){font-size:var(--police-champ)}
html:is(.tactile,.vue-tel) .stepper input[type=number]{font-size:18px}
```

- Le `:is()` interne vaut (0,1,1), même quand il désigne `select` : le total est (0,2,2).
  Il bat `table.data select` (0,1,2), `.o-f select` (0,1,1), `.stepper input` (0,1,1),
  `.dp-side .stepper input` (0,2,1) et `input[type=datetime-local]` (0,1,1).
- La troisième ligne (0,3,2) rétablit les 18 px de la consigne (l. 327), que la deuxième
  aurait ramenés à 16.
- Les boutons radio masqués de `.types` (`type=radio`) ne sont pas visés.

### B6 — Journal du lot lisible

À ≤ 640 px, le journal combine `time{grid-column:1/-1}` (l. 407, vivant) et le gabarit
`auto 80px minmax(0,1fr)` (l. 426, qui écrase l. 406). Résultat : l'heure prend une
ligne entière, l'étiquette la colonne 1, et **le texte la colonne de 80 px**. La colonne
3 reste vide.

```css
html:is(.tactile,.vue-tel) #journal-list li.jl{grid-template-columns:auto minmax(0,1fr);row-gap:4px}
html:is(.tactile,.vue-tel) #journal-list li.jl time{grid-column:1/-1}
```

- Visé par `#journal-list`, qui n'existe que sur le lot en cours (l. 1295). Le journal de
  l'archive (l. 1627, sans id) garde sa propre règle `.dp-grid.arch .journal li.jl`
  (0,4,1), qui est déjà correcte.
- À 430 px : texte ≈ 278 px de large au lieu de 80.

---

## 5. Bloc C — nouveau `@media (max-width:900px)`

```css
@media (max-width:900px){
  /* la marge basse de sécurité est déjà dans .content (l. 95) : ne pas la compter deux fois */
  :root{padding-bottom:0}
  /* paysage : l'îlot dynamique et les bords arrondis mordent à gauche et à droite */
  .topbar{padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
  .content{padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
  .tabbar{padding-left:max(8px,env(safe-area-inset-left,0px));padding-right:max(8px,env(safe-area-inset-right,0px))}
  /* sans effet ici ; reste visible s'il est enfoncé, pour pouvoir sortir de la vue forcée */
  html:not(.vue-tel) #vueBtn{display:none}
}
```

- Dans un `@media` et non sous `tactile` : en vue forcée, le cadre de 430 px est centré
  et loin des bords de l'écran. Les marges latérales y seraient de la place perdue. Le
  bloc A, plus spécifique, les remet donc à 16 px.
- `max(16px, env(…))` vaut 16 px en portrait (encoches latérales nulles) : aucun
  changement sur la capture actuelle.

---

## 6. Emplacements dans le fichier (fins de ligne CRLF à conserver)

| Ajout | Où |
|---|---|
| script de tête (§2.1) | entre l. 9 et l. 10 |
| blocs A, B, C, dans cet ordre | entre l. 492 et l. 493 (`</style>`) |
| bouton `#vueBtn` (§2.2) | l. 511, avant `#themeBtn` |
| icône `tel` (§2.3) | dans `Object.assign(IC, {…})`, l. 865-885 |
| action `vue` (§2.4) | après l. 1668 |
| démarrage (§2.5) | après l. 1773 |

---

## 7. Tableau règle → tokens

| Règle | Tokens existants | Tokens nouveaux (conditionnels) | Littéraux, et pourquoi |
|---|---|---|---|
| A cadre `body` | `--line` (filet du cadre) ; `--bg` hérité par propagation du fond du `body` au canevas | `--cadre-tel` | — |
| A `dialog` | — | `--cadre-tel` | 32 px = 2 × 16 px de gouttière (`.content`) |
| A coquille, `.tabbar` | `--surface`, `--line`, `--muted`, `--accent` (recopiés de l. 96-99) | `--cadre-tel` | valeurs recopiées à l'identique |
| A fiches | `--line`, `--muted` | — | recopiés de l. 212-215 |
| A `#vueBtn` enfoncé | `--accent-soft`, `--accent` | — | — |
| B1 grille | — | — | 250 px (l. 491), 100 % |
| B2 onglets | `--line` (filet), `--accent` (soulignement actif, inchangé) | `--cible` | 4 px, 8 px : largeur calculée pour 430 px (§B2) |
| B3 interrupteur | `--line2`, `--ok` (inchangés) | `--cible` | 56 × 32 (décision), 28 et 24 (géométrie), 16 px d'écart |
| B4 cibles | — | `--cible` | 34, 28, 30 : tailles visibles actuelles |
| B5 champs | `--accent`, `--accent-soft` (anneau de focus, inchangé) | `--cible`, `--police-champ` | 18 px (consigne, l. 327) |
| B6 journal | — | — | 4 px (valeur voulue par l. 406) |
| C marges de sécurité | — | — | 16 px et 8 px (valeurs existantes), `env(safe-area-inset-*)` |

**Symboles absents du jeu de tokens, et leur remplaçant** (à respecter si un correctif en
réclame un) :

| Symbole attendu ailleurs | N'existe pas ici, utiliser |
|---|---|
| `--border`, `--divider` | `--line` (et `--line2` pour les bordures de champ) |
| `--primary`, `--brand` | `--accent` |
| `--primary-soft`, `--focus-ring` | `--accent-soft` (anneau : `0 0 0 3px var(--accent-soft)`, l. 230) |
| `--text` | `--ink` ; `--text-2` → `--ink2` |
| `--text-muted`, `--secondary` | `--muted` ; plus pâle → `--faint` |
| `--card`, `--bg-elevated` | `--surface` ; en retrait → `--surface2` |
| `--success` | `--ok` / `--ok-bg` |
| `--danger`, `--error` | `--bad` / `--bad-bg` |
| `--warning` | `--warn` / `--warn-bg` |
| `--switch-off` / `--switch-on` / `--knob` | `--line2` / `--ok` / littéral `#fff` |
| `--radius` | aucun token : 7 px (bouton, champ), 10 px (carte), 999 px (interrupteur) |
| `--space-*` | aucun token : 16 px de gouttière mobile, 8 px d'écart courant |
| `--tap-size`, `--touch-target` | `--cible` (nouveau, défini sous `html:is(.tactile,.vue-tel)` seulement) |
| `--font-size-input` | `--police-champ` (nouveau, idem) |

---

## 8. Critique des trois constats

**Constat 1 — « la grille reste à 2 colonnes ; la mesure de débordement ne voit rien ».**
La lecture est juste. Il manque la cause, qui décide du correctif. La règle voulue
existe : `@media (max-width:1180px){.home-grid{grid-template-columns:1fr}}`, l. 490.
La l. 492, `@media (max-width:1360px){.home-grid{minmax(0,1fr) 300px}}`, de même
spécificité mais placée **après**, la neutralise à toute largeur ≤ 1180 px. À 430 px :
398 − 300 − 14 = **84 px** pour les lots, ce que confirme la capture (≈ 82 px). La mesure
ne voit rien parce que les cartes de lot (250 px minimum) débordent **dans**
`.scroll-card`, qui est en `overflow:hidden` (l. 364). Le débordement est découpé, donc
invisible pour `scrollWidth` du document et pour un filtre « découpé par un ancêtre »
comme celui de `verifie-mobile.mjs`. D'où le critère 3 de l'acceptation, « débordement
masqué ».

**Constat 2 — « onglets coupés, 16 px, 3 éléments hors cadre ».** Juste, et les chiffres
se recoupent : sur la capture, « Prises » commence à 371 px, et sa pastille avec la
marge finit à ≈ 445 px, soit 15-16 px au-delà de 430. Deux précisions :
- les onglets débordent de **la carte** de ≈ 32 px (la carte finit à 414 px). Seuls les
  16 derniers dépassent de l'écran, le reste passe sous le bord de la carte ;
- un simple resserrement ne suffit pas au-delà de l'iPhone 15 Pro Max : à 390 et 360 px,
  il manque encore 18 et 48 px. D'où le défilement latéral de repli (B2). Et si les
  polices Google ne chargent pas (réseau local sans Internet), la police système a
  d'autres largeurs.

**Constat 3 — « 6 cibles sur la vue d'ensemble, 17 sur Appareils ».** Le 6 est exact et
se retrouve dans le code : thème 34 × 34, logo 28 × 28, « Appareils » et « Lancer une
fermentation » à 36 de haut, « Voir les recettes » et « Tout voir » à 30. Le **17 ne se
retrouve pas**. Avec les données de démonstration (9 appareils, dont 5 prises) et le
filtre « Tous », le code donne **31** cibles trop petites : thème, logo, « Ajouter un
appareil », 9 sélecteurs « Fermentation » à 30 px, 9 × à 34 px, 5 sélecteurs « Mode » à
30 px et 5 interrupteurs. Probablement un comptage limité à l'écran visible, ou d'autres
données. Dans le détail :
- « filtres 30 px de haut » ne vise pas Appareils, dont les filtres sont des onglets de
  44 px. Les filtres de 30 px sont les `.seg` des Recettes, de l'Archive et du journal ;
- la catégorie la plus nombreuse manque : les **sélecteurs** (`table.data select` 30 px,
  `.o-f select` 32 px), et plus généralement tous les champs à 36 px ;
- « déjà en place : `env(safe-area-inset-*)` géré » est vrai pour le haut et le bas
  seulement. Gauche et droite ne le sont nulle part, d'où le bloc C ;
- « plus petit texte : 11,5 px » : les graduations des graphiques SVG sont en **11 px**
  (`font-size="11"`, l. 750, 754, 759) ;
- « Vue d'ensemble / Archive / Recettes : 0 px, rien à corriger » : faux pour la vue
  d'ensemble (constat 1, masqué). Et les pages de **détail** n'ont pas été mesurées
  (`#/f/…`, `#/archive/…`, `#/recettes/…`), alors que c'est là que se trouvent le
  journal à 80 px (B6) et les hauteurs fixes (§9.4).

---

## 9. Ce que le code casserait sur un téléphone et que la mesure n'a pas vu

1. **Deux régulateurs dès la première ouverture sur le téléphone.** Hors CSS, et le plus
   grave. Tout l'état (lots, consignes, liaisons des prises) vit dans le `localStorage`
   de **chaque navigateur** (`STORE`, l. 580). Le verrou `regulMaitre` (l. 531) ne
   départage que les onglets d'un **même** navigateur. Safari sur l'iPhone part donc des
   données de démonstration (`seed()`) : Saison à 24 °C sur la prise 1, Koji à 30 °C sur
   la prise 2, prises en `auto`. Dès le jeton saisi, il régule les **vraies** prises
   selon ces consignes, pendant que l'ordinateur les régule selon les siennes. La
   capture le laisse deviner : « activation de la chauffe » il y a 0 s et 3 s dès
   l'ouverture. Là, c'était la simulation, sans jeton (167 W = 160 + aléa, l. 707). La
   logique est bien « unique dans le fichier », mais pas unique dans la maison. À
   trancher (§10, point 6).
2. **Le zoom de Safari au focus.** Tous les champs sont à 14 px, et les sélecteurs des
   appareils à 13 px. Toucher « Fermentation » ou « Mode » zoome la page, qui reste
   zoomée, avec un défilement latéral. L'émulation ne reproduit pas ce zoom (B5).
3. **Le paysage de l'iPhone 15 Pro Max vaut 932 px, donc plus de 900 px.** Le téléphone
   tourné reçoit la mise en page du bureau : colonne latérale de 236 px, aucune barre
   d'onglets, cibles de souris. La colonne passe sous l'îlot dynamique, car
   `viewport-fit=cover` sans marge gauche. Sans `-webkit-text-size-adjust`, Safari
   grossit en plus le texte en paysage. C'est le cas d'usage réel du bouton « Vue
   téléphone ».
4. **Des hauteurs qui dépendent de la fenêtre ou qui sont fixes.**
   `@media (min-width:1101px) and (min-height:640px)` fixe `.dp` à `100dvh − 100 px`. Sans
   effet sur le téléphone, mais actif en vue forcée à 1440 × 900 : la vue d'ensemble et
   le détail seraient comprimés dans la hauteur de la fenêtre (neutralisé au bloc A). Sur
   le téléphone, des zones qui défilent sont **imbriquées** dans la page qui défile :
   activité récente (360 px), journal (420 px), relevés de densité (240 px), graphiques
   et journal de l'archive (320 et 360 px). Un doigt posé dessus fait défiler la zone, pas
   la page. Rien ne déborde, donc la mesure ne voit rien (§10, point 7).
5. **Une cible dangereuse à côté d'une autre.** Dans la fiche d'une prise,
   l'interrupteur, qui commande un relais réel, est à 8 px du × « Retirer ». Réglé par
   `.ctl{gap:16px}` (B3).
6. **Le rendu complet en arrière-plan.** `regulerPont` et `pontBascule` appellent
   `render()` (l. 1087, 1094, 1128, 1133), qui remplace tout `#view`. Sur iOS, un
   sélecteur ouvert (roue native) ou un champ en saisie se ferme sans prévenir quand la
   régulation agit pendant qu'on choisit. Hors CSS.
7. **Un défilement latéral de tableau.** `.grav-list` (cellules `nowrap`, l. 420, et
   bouton × par ligne) demande ≈ 304 px. Ça tient à 430 px, mais à 360 px (292 px
   disponibles) le tableau défile latéralement dans sa zone. C'est toléré par le critère
   « sous défilement latéral », mais c'est un vrai défilement.
8. **Deux points mineurs.** Sur Recettes et Archive, la cellule `td.first` en fiche est
   un `flex` en ligne : nom et description s'affichent **côte à côte** et non l'un sous
   l'autre (sans débordement, mais peu lisible). Le filet de focus des onglets est
   découpé par le conteneur qui défile (B2), ce qui ne concerne que le clavier.

---

## 10. Ce que je n'ai pas tranché

1. **L'invariance du bureau et le bouton.** Le bouton étant dans la barre du haut
   (décision utilisateur), `.top-right` s'élargit de 48 px (34 + 14 d'écart) à toutes
   les largeurs de bureau. L'identité au pixel près est impossible pour cette zone.
   L'acceptation la mesure donc « à `.top-right` près », avec un bord droit et un
   `#themeBtn` identiques. Si l'identité stricte est exigée, il faudrait un autre
   emplacement : le pied de la colonne latérale (`.side-foot`) ne bouge rien dans la
   barre du haut, mais c'est contraire à la décision.
2. **Cadre de 430 px ou pleine largeur en vue forcée.** J'ai choisi le cadre, parce que
   c'est la seule façon d'obtenir une vraie présentation téléphone sans toucher aux
   `@media` existants. En paysage sur l'iPhone (932), cela donne une colonne de 430 px
   centrée. L'autre voie, la pleine largeur, demande de réécrire sous `vue-tel` toutes
   les grilles `auto-fill` avec des valeurs propres : c'est un autre dessin.
3. **Le bouton masqué sous 900 px** quand il n'est pas enfoncé : sans effet à ces
   largeurs, il ne ferait qu'occuper la barre. S'il est enfoncé, il reste visible pour
   pouvoir sortir de la vue forcée.
4. **`html{-webkit-text-size-adjust:100%;text-size-adjust:100%}`.** C'est le remède au
   grossissement du texte en paysage (§9.3). Il faut le poser **sans condition**, puisque
   le paysage à 932 px n'a aucune classe. C'est donc formellement une règle de base.
   Elle est sans effet sur un moteur de bureau, où l'ajustement automatique n'existe
   pas, mais la décision revient à l'utilisateur.
5. **Poser `tactile` aussi pour `(pointer:coarse)`.** Cela donnerait les cibles et les
   champs de 16 px au téléphone en paysage (932) et aux tablettes, sans la vue forcée.
   Mais `tactile` porte aussi la grille à une colonne (B1) : il faudrait alors séparer
   les règles de taille des règles de mise en page. Non fait.
6. **Le second régulateur (§9.1).** Pistes, sans en choisir une : un état partagé servi
   par le pont ; une régulation réservée à une seule page désignée ; ou, au minimum, sur
   un profil encore vierge (données de démonstration), aucune régulation réelle tant que
   l'utilisateur n'a pas relié lui-même un lot. C'est une question de sûreté, pas de mise
   en page, mais c'est l'usage mobile qui la déclenche.
7. **Les zones qui défilent dans la page (§9.4).** Faut-il les déplier sur téléphone
   (activité limitée à 10 entrées, journal sans hauteur fixe) ? C'est un changement de
   contenu, pas un correctif. Laissé tel quel.
8. **L'onglet actif hors de vue** quand la barre défile (390 et 360 px) : il faudrait un
   `scrollIntoView({inline:'nearest'})` après `render()`. C'est du JS, et hors du
   téléphone cible (tout tient à 430 px).
9. **L'outil `outils/decoupe-vue-telephone.py`** ne couvre que 2 des 9 conditions en jeu
   (900 et 640). Il ignore 1360, 1250, 1180, 1100, 760 et 440, ainsi que le verrou
   `min-width:1101px`. Par hausse de spécificité, il introduirait les trois divergences
   du §1.2. Je le remplace par le bloc A écrit à la main. Le corriger est possible mais
   pas nécessaire.
10. **Deux écarts avec le brief, à vérifier.**
    - La « coupure de sécurité après 90 min » est celle **du pont** (`PONT_CHAUFFE_MAX`,
      `k8s/deployment.yaml` l. 94-96) ; celle **de la page** est de 45 min
      (`AUTO_MAX_ON`, l. 525). Les deux coexistent, et rien ici n'y touche.
    - « Aucun CDN » : le fichier charge IBM Plex Sans depuis `fonts.googleapis.com`
      (l. 7-9). Sur le réseau local sans Internet, c'est la police système qui s'affiche,
      et les largeurs de texte changent. Laissé tel quel, puisque le retirer change le
      rendu du bureau.
