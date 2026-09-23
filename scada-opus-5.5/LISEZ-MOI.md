# Scada-opus-5.5 — dashboard Hakko

Reconstruction du dashboard de supervision des fermentations, **à l'identique** de la
spécification, avec sa vérification complète.

## Ouvrir

- **http://192.168.1.51:8090/** — la page d'accueil qui liste tout
- **http://192.168.1.51:8090/hakko-dashboard.html** — le dashboard directement

## Démarrer / arrêter le service

```bash
/home/homelab/Scada-opus-5.5/servir.sh     # démarre (port 8090), idempotent
/home/homelab/Scada-opus-5.5/arreter.sh    # arrête
tail -f /home/homelab/Scada-opus-5.5/.serveur.log   # journal
```

Servi par `python3 -m http.server 8090 --bind 0.0.0.0`, détaché avec `setsid nohup`
(pas de `sudo` sur cette machine, donc pas de service systemd). Il survit à la déconnexion,
pas au redémarrage — pour l'automatiser : `crontab -e` puis
`@reboot /home/homelab/Scada-opus-5.5/servir.sh`.

## Contenu

| Chemin | Quoi |
|---|---|
| `hakko-dashboard.html` | **le livrable** : un seul fichier autonome, 7 pages, clair/sombre, `localStorage` |
| `README.md` | la spécification complète (annexes A/B/C = source de référence) |
| `RAPPORT-FINAL.txt` / `_build/RAPPORT-FINAL.md` | rapport final : méthode, mesures, défauts |
| `_build/CONTRAT.md`, `_build/PARTITIONS.md` | contrat de fabrication et partition en 8 modules |
| `_build/parts/` | les 8 modules transcrits, source de l'assemblage |
| `_build/assemblage.py`, `_build/serve.py` | assemblage contrôlé et serveur local de développement |
| `_build/fix-densite.patch` | correctif prêt (non appliqué) du débordement Densité en 1280 × 720 |
| `_build/pleine-largeur.patch` | le passage en pleine largeur (déjà appliqué au livrable) |
| `_build/logs/` | traces brutes des agents (Opus 5.5 et sous-agents) |
| `_verify/verifie.mjs` | harnais headless : 365 assertions, comparaison A/B, contrôle négatif |
| `_verify/RAPPORT.txt` / `.md` | sorties réelles du harnais |
| `_verify/revue-opus.md` | revue qualité : 0 bloquant, 7 majeurs, 22 mineurs, avec `fichier:ligne` |
| `_verify/sortie-*/`, `_verify/captures-*/` | captures et rapports JSON de chaque exécution |
| `_verify/reference-original.html` | la référence d'origine, conservée pour comparaison |
| `Accueil.png`, `bière.png`, `Capture d'écran*.png` | captures de référence fournies par l'utilisateur |

## Notes

- Le livrable est **byte-identique** à la référence (`sha256 211fbb2d…`), puis passé en pleine
  largeur à la demande (`sha256 477502b6…`, hash actuellement servi).
- Le harnais s'exécute depuis le PC Windows : il a besoin de Node et de Microsoft Edge, et pilote
  un navigateur. Ses résultats sont inclus ici, mais il n'est pas fait pour tourner sur ce serveur.
- Les `node_modules` (29 Mo) et le fichier de mots de passe du serveur ne sont pas inclus.
