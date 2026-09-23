# Image statique du dashboard « Scada-opus-5.5 » (Hakko / FermentLab).
# Aucune compilation : hakko-dashboard.html est un livrable autonome, nginx le sert tel quel.
#
# Contexte de build = CE dossier (scada-opus-5.5/), pas la racine du dépôt.
#   docker build -t scada-opus-5.5 scada-opus-5.5
# Raison : le .dockerignore de la racine du dépôt exclut « README.md », ce qui priverait
# l'image de scada-opus-5.5/README.md (la spécification). Ici le contexte est le dossier
# lui-même, avec son propre .dockerignore : l'image ne dépend donc d'aucun réglage externe.

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

EXPOSE 80

# nginx en avant-plan : le conteneur reste vivant, les logs partent sur stdout.
CMD ["nginx", "-g", "daemon off;"]
