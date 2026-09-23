# Image du « pont » : le petit service qui parle à Home Assistant pour le dashboard.
# Aucune dépendance hors bibliothèque standard — rien à installer au démarrage, image
# minuscule, et pas de réseau nécessaire à la construction.
FROM python:3.13-alpine

# Utilisateur non privilégié : l'UID est fixe pour rester lisible dans les manifestes.
RUN adduser -D -H -u 10001 pont

WORKDIR /app
COPY pont.py /app/pont.py
RUN chown -R 10001:10001 /app

USER 10001
EXPOSE 8080

# Écoute sur la boucle locale : le pont n'est joignable que par nginx, dans le même pod
# (même espace réseau), qui l'expose sur /api/. Rien d'autre dans le cluster ne peut
# l'atteindre, et la sonde de Kubernetes passe par nginx (port « http »).
# PYTHONDONTWRITEBYTECODE : la racine du conteneur est montée en lecture seule.
ENV PONT_ADRESSE=127.0.0.1 \
    PONT_PORT=8080 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

CMD ["python", "/app/pont.py"]
