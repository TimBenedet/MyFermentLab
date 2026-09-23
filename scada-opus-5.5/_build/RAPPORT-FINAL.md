# Rapport final — reconstruction du dashboard Hakko

## Livrable

| | |
|---|---|
| Fichier | `hakko-dashboard.html` (racine du projet) |
| Taille | 120 430 octets, 1 588 lignes, un seul fichier autonome (HTML + CSS + JS inline, sans build ni dépendance) |
| Empreinte | `211fbb2dd5b6a2ff01a320e3db91237705c35090fc4ab7345a7540e70c1dcf2a` |
| Référence | identique **octet pour octet** à `_verify/reference-original.html` (mêmes annexes A/B/C du README) |
| Ouverture | `http://127.0.0.1:8812/hakko-dashboard.html` (serveur `_build/serve.py`), ou le fichier directement dans un navigateur |

## Comment il a été produit

1. **Partition** (`_build/PARTITIONS.md`, `_build/CONTRAT.md`) : la spec et sa source de référence
   découpées en 8 plages de lignes disjointes (en-tête, corps, 2 × CSS, 4 × JavaScript), 1 578 lignes.
2. **Transcription** : 8 sous-agents deepseek-flash, un fichier chacun, copie verbatim et
   auto-vérification par `diff` contre la plage source. Les 8 parts sont byte-exactes
   (contrôle indépendant du parent : 8/8, `diff` vide et nombre de lignes exact).
3. **Assemblage** : `_build/assemblage.py` (propriété du parent) reconstitue le fichier unique,
   restitue les 4 lignes vides de jointure et la ligne vide finale du script → `diff` vide,
   SHA-256 identique.
4. **Vérification** : harnais headless `_verify/verifie.mjs` (Opus 5.5), 365 assertions en A/B,
   **relancé par le parent** avec les mêmes résultats. Contrôle négatif : copie sabotée → 29 échecs.
5. **Revue qualité** : Opus 5.5, `_verify/revue-opus.md` (0 bloquant, 7 majeurs, 22 mineurs),
   dont les constats les plus lourds ont été re-dérivés par le parent (voir §Défauts).

## Résultats de vérification (parent)

```
365 assertions · 361 OK · 4 échecs · divergences A/B : 0 · code de sortie 1
§10.1 aucune erreur console/pageerror/HTTP≥400 : 66/66
§3.1  jetons de thème effectifs                  : 64/64
§10.2 défilement du document = 0                 : 48/48
§10.3 → §10.8 checklist d'acceptation            : 54/54
§9    mise en page « un seul écran »             : 68/72
A=B   comparaison A/B normalisée                 : 0 divergence
```

Aucune erreur JavaScript sur les 32 cas (2 viewports × 2 thèmes × 8 routes).
Défilement du document à 0 sur `#/`, `#/f/b1`, `#/archive/b0` et `#/archive/:id`.
Les 8 points de la checklist §10 passent, y compris : consigne 24→27 °C produisant
« Activation de la chauffe », relevé de densité daté au 18 sept. placé au rang 3 et au bon
point du graphique, les 5 prises basculant de OFF rouge à ON vert, état conservé après rechargement.

## Défauts — ce que le parent a re-dérivé lui-même

**Confirmés par lecture du code ou par mesure**

- **M7 — le seul échec du harnais** : `hakko-dashboard.html:703`
  `H = fill ? Math.max(120, el.clientHeight) : …` impose 120 px de hauteur de tracé ; en 1280 × 720
  la carte « Densité » de la fiche d'archive n'a que 101,6 px → SVG de 120 px, **débordement 18,4 px**,
  étiquettes d'axe (posées à `H - 6`) **recouvrant la légende sur 12,4 px**.
- **M1** `tick()` : `if (d.mode === 'auto' && b){ const tp = currentTemp(b); if (tp != null){…} }` —
  un lot qui perd sa sonde laisse la prise **allumée indéfiniment** à ~160 W alors que le lot
  affiche « Sans sonde ».
- **M5** `archStats` : `duty: onMs / span * 100` avec un pas de simulation plancher de 5 minutes
  (`st = Math.max(5*60000, span/20000)`) : sur un lot court, le pas dépasse la durée totale →
  un lot terminé en 5,7 s affiche **5 298 %** de temps de chauffe.
- **M6** `humCfg(b)` : `from = b.start` en dur et `xFmt: fmtTime` — sur l'onglet Humidité, les
  boutons 24 h / 7 j / Tout **ne changent rien** au graphique, contrairement à l'onglet Température.
- **M3** : `S.events.length = Math.min(S.events.length, 500)` (lignes 876 et 881) alors que §6.4
  annonce un « Journal figé » — mécanisme confirmé, conséquence non reproduite par le parent.
- **M4** : lignes de tableau cliquables en `data-href` **sans** `tabindex` ni gestion clavier ;
  aucun lien ne mène à `#/archive/:id` (seul le fil d'Ariane pointe `#/archive/`).
- **m1** : `hakko-dashboard.html:1178` (`${r.salt} % sel`) et `:693` (`Jour X sur ${dur}`) affichent
  les nombres bruts, sans passer par `fmt()` → « 10.5 % sel », « Jour 1 sur 10.5 » à côté de « 11 % ».
- **m11** : la validation (`:1552`) ne rejette que `duration <= 0` ; l'attribut `min="0.5"` du champ
  n'arrête rien → une durée de 0,1 jour est acceptée.
- **m17** : contraste de `--faint` sur carte = **2,54:1** en thème clair (recalculé par le parent),
  sous le seuil AA de 4,5:1.

**Corrections apportées à la revue par le parent** — deux constats d'Opus ne tiennent pas tels quels :

- **m12 est faux** : Opus annonce que le garum voit son bruit « amplifié (×1,6) ». Le code fait
  `if (r.type === 'garum') temp += n * 0.6;` — c'est bien une **réduction** du bruit, conforme au
  « bruit réduit » de §8. Constat retiré.
- **m13 est exagéré** : les puissances de §8 sont bien là
  (`d.power = d.on ? (d.id === 'p3' ? 410 : 160) + Math.random()*12 : 0.4`). L'écart réel est un
  **jitter aléatoire de 0 à 12 W** ajouté aux 160/410 W, pas d'autres valeurs. Rétrogradé en mineur.

**Non re-dérivés par le parent** (rapportés par la revue, cohérents mais non reproduits) : M2 (relevé
antérieur au début du lot ramené sans avertissement, suppression qui emporte le relevé initial),
m2, m3, m5, m6, m8, m9, m10, m16, m18 → m22. Détail complet dans `_verify/revue-opus.md`.

Fait notable : **tous ces défauts viennent de la spécification elle-même** — le livrable étant
byte-identique à la référence, il les reproduit tous, y compris M7.

## Correctif disponible (non appliqué)

`_build/fix-densite.patch` — seuil de hauteur 120 → 60 px, une ligne, validé : le patch s'applique
proprement sur une copie et reproduit exactement la copie testée `_verify/fix-densite.html`.

| Mesure en 1280 × 720, fiche d'archive | hauteur SVG | débordement | recouvrement légende |
|---|---|---|---|
| livrable (identique à la référence) | 120 px | 18,4 px | 12,4 px |
| copie corrigée | 102 px | 0,4 px | 0 px |

En 1440 × 860 : identique dans les deux cas (171 px = 171 px).

Application, si tu le décides :

```
patch -p0 hakko-dashboard.html _build/fix-densite.patch
```

## Modification demandée après la livraison — occuper toute la largeur

Constat rapporté par l'utilisateur sur sa capture (écran 1920 px, zone vide à droite) :
`.content{padding:28px 32px 64px;max-width:1440px;width:100%}` plafonnait le contenu à 1440 px,
soit **236 + 1440 = 1676 px** de fenêtre utile — au-delà, tout l'espace restant était perdu
(244 px à 1920, 884 px à 2560, 1 764 px à 3440).

Correctif appliqué : retrait de `max-width` sur `.content` (`_build/pleine-largeur.patch`), soit
`.content{padding:28px 32px 64px;width:100%}`. Nouvelle empreinte du livrable :
`477502b636c8173f04be2ad088230217d82337b1e8b2b78969a03adb193ec927`.
La version strictement identique à la référence reste disponible :
`_verify/version-identique-1440.html` (`211fbb2d…`) et `_verify/reference-original.html`.

Mesures, 7 routes × 2 thèmes, avant / après (thème sombre, viewports 1440 → 3440 px) :

| Fenêtre | espace vide à droite AVANT | APRÈS | défilement horizontal | débordement à droite |
|---|---|---|---|---|
| 1440 × 860 | 0 | 0 | 0 | 0 |
| 1656 × 915 | 0 | 0 | 0 | 0 |
| 1920 × 1000 | **244 px** | **0** | 0 | 0 |
| 2560 × 1200 | **884 px** | **0** | 0 | 0 |
| 3440 × 1400 | **1 764 px** | **0** | 0 | 0 |

Effets visuels à 1920 : les 4 tuiles de lot passent de 3 colonnes + 1 ligne de débord à
**4 colonnes sur une seule ligne** ; les 4 KPI occupent toute la largeur ; le panneau de droite
(Activité récente, État des appareils) vient au bord ; le tableau des appareils et le graphique du
détail s'élargissent sans étirement anormal.

**Non-régression** : harnais rejoué sur le livrable après modification →
182 assertions, 180 OK, **les 2 seuls échecs sont ceux d'avant** (§9, `#arch-2` en 1280 × 720, M7).
Aucune erreur JavaScript sur les 7 routes à 1920 et 2560 ; défilement du document à 0 sur
`#/`, `#/f/b1`, `#/archive`, `#/archive/b0` et `#/recettes`, à 1920 comme à 2560.

## Arborescence

```
hakko-dashboard.html            le livrable (identique à la référence)
_build/CONTRAT.md               contrat : partition, règles, critères d'acceptation
_build/PARTITIONS.md            table des 8 plages de lignes
_build/parts/                   les 8 modules transcrits (byte-exacts)
_build/assemblage.py            assemblage + contrôle d'identité
_build/fix-densite.patch        correctif du débordement (non appliqué)
_build/logs/                    traces des agents (sorties brutes)
_verify/verifie.mjs             harnais headless (365 assertions, A/B)
_verify/RAPPORT.md              rapport du harnais (sorties brutes collées)
_verify/revue-opus.md           revue qualité par Opus 5.5
_verify/reference-original.html la référence, conservée pour comparaison
_verify/sortie-a, sortie-parent captures et rapports JSON des exécutions
```
