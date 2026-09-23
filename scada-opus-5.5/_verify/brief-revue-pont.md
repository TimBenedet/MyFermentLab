# Revue Opus — sécurité et robustesse du « pont » Home Assistant (Scada-opus-5.5)

Tu es un ingénieur sécurité. Objectif : **trouver des failles exploitables et des défauts de
conception**, pas commenter le style. Réponds en français, en texte brut (pas de fichier à
écrire), structuré comme demandé à la fin.

## Ce qui a été construit

Le dashboard `hakko-dashboard.html` (site statique servi par nginx dans le pod `scada-opus`,
namespace `scada-opus`, NodePort 30090, ingress `hakko.myfermentlab`) doit pouvoir **commander
réellement 5 prises** d'une multiprise pilotée par Home Assistant (`http://192.168.1.51:8123`,
réseau local, jeton d'accès longue durée).

Mesures déjà faites, à ne pas re-signaler :
- L'API de Home Assistant n'envoie **aucun** en-tête CORS : un appel depuis le navigateur est
  impossible sans reconfigurer Home Assistant côté CORS (écarté) ;
- mettre le jeton dans la page est écarté (décision de l'utilisateur) ;
- la voie d'écriture fonctionne avec ce jeton (`POST /api/services/switch/turn_off` → HTTP 200) ;
- le pont en essai a passé 14 contrôles : sonde sans authentification, 401 sans/mauvais jeton,
  5 prises + 4 sondes remontées, 403 hors liste blanche, 400 sur corps invalide ou `allume` non
  booléen, commande réelle d'une prise déjà éteinte (état inchangé).

## Architecture retenue

`nginx` et `pont` (service Python) tournent dans **le même pod**, donc le même espace réseau :
nginx expose `/api/` en `proxy_pass http://127.0.0.1:8080`, le port du pont n'est **pas** publié
par le Service (seul le port 80 l'est). Le dashboard appelle donc `/api/etat` et `/api/prise` sur
**sa propre origine**, sans CORS, et le jeton ne quitte jamais le pod. Le pont est livré par la
même chaîne GitOps que le site (image `ghcr.io/timbenedet/myfermentlab-pont`, ArgoCD synchronise).

## Fichiers à relire (chemins WSL)

- `/mnt/c/Users/Timothée/Documents/IA/Hermes/MyFermentLab/scada-opus-5.5/pont/pont.py` (le service)
- `/mnt/c/Users/Timothée/Documents/IA/Hermes/MyFermentLab/scada-opus-5.5/pont/Dockerfile`
- `/mnt/c/Users/Timothée/Documents/IA/Hermes/MyFermentLab/scada-opus-5.5/nginx.conf`
- `/mnt/c/Users/Timothée/Documents/IA/Hermes/MyFermentLab/scada-opus-5.5/k8s/deployment.yaml`
- `/mnt/c/Users/Timothée/Documents/IA/Hermes/MyFermentLab/scada-opus-5.5/hakko-dashboard.html`
  — **uniquement** le bloc `/* ---------- Pont Home Assistant (même origine : /api/) ---------- */`,
  les deux boucles de `tick()`, le démarrage en fin de fichier et le cas `toggle-plug` du
  répartiteur d'actions (cherche `pont` dans le fichier). Le reste du fichier est une maquette
  déjà validée par un harnais de 182 assertions : ne la relis pas.

## Modèle de menace à considérer

1. Un appareil du réseau local (invité, objet connecté compromis) qui parle directement au
   NodePort 30090 ou à l'ingress.
2. Une page web hostile ouverte dans le navigateur de l'utilisateur (CSRF, lecture cross-origin).
3. Le contenu du dashboard lui-même comme vecteur (XSS qui volerait le jeton du pont stocké
   dans `localStorage` — regarde comment la page échappe les chaînes qu'elle affiche).
4. Home Assistant indisponible, lent, ou renvoyant des données inattendues (types, valeurs
   non numériques, entité disparue).
5. Un redémarrage / une resynchronisation qui laisserait une prise allumée : y a-t-il un
   chemin où le pont **allume** une prise sans clic explicite de l'utilisateur ?

## Ce que je veux en sortie

1. **Failles** classées (bloquant / majeur / mineur), chacune avec : le scénario
   d'exploitation concret, la ligne ou la fonction concernée, et la correction minimale.
2. **Défauts de robustesse** : que se passe-t-il si Home Assistant tombe, répond lentement, ou
   renvoie `unknown`/`unavailable`/une chaîne non numérique ? Le pont peut-il bloquer, fuir de
   la mémoire, ou renvoyer un état faux à l'interface ?
3. **Vérifications que tu recommandes** : les 3 à 5 contrôles les plus discriminants que je
   devrais exécuter moi-même après déploiement, sous forme de commandes `curl` exactes.
4. Une phrase de verdict : peut-on laisser ceci en service sur un réseau domestique ?

Sois précis et concis. Si un point est déjà couvert correctement, dis-le en une ligne plutôt
que de le détailler.
