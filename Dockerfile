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

# Saudavel = processo de pe E banco respondendo (/api/health/ready). Alpine ja traz o wget (busybox).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/api/health/ready >/dev/null || exit 1

# Aplica migracoes pendentes a cada deploy (idempotente) e sobe a API. ";" e nao "&&" de
# proposito: se uma migracao falhar, a API antiga continua de pe (o erro fica no log).
CMD ["sh", "-c", "node src/database/migrate.js; exec node src/server.js"]
