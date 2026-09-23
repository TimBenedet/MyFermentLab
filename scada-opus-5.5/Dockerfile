# Image statique du dashboard « Scada-opus-5.5 » (Hakko / FermentLab).
# Aucune compilation : hakko-dashboard.html est un livrable autonome, nginx le sert tel quel.
#
# Contexte de build = CE dossier (scada-opus-5.5/), pas la racine du dépôt :
#   docker build -t scada-opus-5.5 scada-opus-5.5
# Raison : le .dockerignore de la racine du dépôt exclut « README.md », dont l'image a
# besoin. Ici le contexte est le dossier lui-même, avec son propre .dockerignore : l'image
# ne dépend donc d'aucun réglage extérieur.

FROM nginx:1.29-alpine

# Version injectée par la CI : --build-arg VERSION=scada-opus-abc1234 (défaut « dev »).
ARG VERSION=dev

LABEL org.opencontainers.image.title="Scada-opus-5.5" \
      org.opencontainers.image.description="Dashboard de supervision des fermentations (Hakko), servi en statique par nginx" \
      org.opencontainers.image.source="https://github.com/TimBenedet/MyFermentLab" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}"

# Configuration du serveur : markdown affiché plutôt que téléchargé, /healthz, cache, gzip.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Tout le dossier livré : dashboard, page d'accueil, spécification, rapport, scripts de
# service, et les sous-dossiers _build/ et _verify/ (chaîne de fabrication et preuves).
COPY . /usr/share/nginx/html/

# Deux garde-fous en une commande :
#  - le Dockerfile fait partie du contexte (BuildKit refuse de lire un Dockerfile écarté
#    par .dockerignore), on le retire donc de la racine web après coup ;
#  - on vérifie que le contexte était bien ce dossier : depuis un contexte plus large, le
#    COPY ci-dessus amputerait le site sans provoquer la moindre erreur.
RUN rm -f /usr/share/nginx/html/Dockerfile \
 && test -f /usr/share/nginx/html/hakko-dashboard.html \
 || { echo "ERREUR : contexte de build invalide — attendu : docker build -f scada-opus-5.5/Dockerfile scada-opus-5.5" >&2; exit 1; }

EXPOSE 80

# nginx en avant-plan : le conteneur reste vivant, les logs partent sur stdout.
CMD ["nginx", "-g", "daemon off;"]
