# Imagem de producao do backend do Meu Bolso Digital.
# Contexto de build: a raiz do repositorio (precisa enxergar backend/ e database/ juntos,
# porque backend/src/database/migrate.js le os arquivos .sql de ../../../database/migrations).
FROM node:20-alpine

WORKDIR /app

COPY --chown=node:node backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY --chown=node:node backend ./backend
COPY --chown=node:node database ./database

WORKDIR /app/backend
ENV NODE_ENV=production
EXPOSE 3000
USER node

CMD ["node", "src/server.js"]
