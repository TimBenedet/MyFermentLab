FROM node:20-alpine

WORKDIR /app

# Installer les dépendances de build pour better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Nettoyer les dépendances de dev
RUN npm prune --production

EXPOSE 3001

CMD ["node", "dist/index.js"]
