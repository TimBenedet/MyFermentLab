# Build stage
# Node 22 et non 20 : l'application s'appuie sur Vite 8 et TypeScript 7, qui
# demandent une version que node:20-slim ne garantit plus.
FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:stable

COPY --from=builder /app/dist /usr/share/nginx/html
# Dans /etc/nginx/templates/ et non dans conf.d/ : l'entrypoint de l'image nginx
# passe les gabarits à envsubst au démarrage, ce qui y injecte HASS_URL et
# HASS_TOKEN sans qu'ils soient jamais gravés dans une couche de l'image.
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
