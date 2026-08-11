# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS production-dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN --mount=type=cache,id=rfly-backend-prod-npm,target=/root/.npm,sharing=locked \
    PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x npm ci --omit=dev \
    && npm cache clean --force

FROM ${NODE_IMAGE} AS migration-dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN --mount=type=cache,id=rfly-backend-migration-npm,target=/root/.npm,sharing=locked \
    PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x npm ci \
    && npm cache clean --force

FROM ${NODE_IMAGE} AS runtime-base
ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app
RUN apk upgrade --no-cache \
    && apk add --no-cache ca-certificates openssl \
    && rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx
COPY docker/entrypoint.sh /usr/local/bin/operations-entrypoint
RUN chmod 0444 /usr/local/bin/operations-entrypoint \
    && chown node:node /app
ENTRYPOINT ["/bin/sh", "/usr/local/bin/operations-entrypoint"]

FROM runtime-base AS runtime
COPY --from=production-dependencies --chown=node:node /workspace/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json app.js server.js ./
COPY --chown=node:node config ./config
COPY --chown=node:node controllers ./controllers
COPY --chown=node:node jobs ./jobs
COPY --chown=node:node middleware ./middleware
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node routes ./routes
COPY --chown=node:node services ./services
COPY --chown=node:node sockets ./sockets
COPY --chown=node:node src ./src
USER node
EXPOSE 5000
HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:5000/api/health',{headers:{'X-Forwarded-Proto':'https'}}).then(r=>{if(!r.ok)throw new Error(String(r.status))}).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]

FROM runtime-base AS migration
ENV APP_RUNTIME_MODE=migration
COPY --from=migration-dependencies --chown=node:node /workspace/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node prisma ./prisma
USER node
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

# Operator-only, one-shot workbook importer. The normal API runtime deliberately
# does not contain this CLI or its spreadsheet parser.
FROM runtime-base AS importer
ENV APP_RUNTIME_MODE=importer
COPY --from=production-dependencies --chown=node:node /workspace/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node importer ./importer
COPY --chown=node:node services/farmerDataImportService.js services/droneDataImportService.js ./services/
COPY --chown=node:node src/lib ./src/lib
COPY --chown=node:node src/repositories/importRepository.js src/repositories/droneImportRepository.js src/repositories/historyActorRepository.js src/repositories/normalizedCompatibilityRepository.js src/repositories/auditLogRepository.js ./src/repositories/
USER node
ENTRYPOINT ["/bin/sh", "/usr/local/bin/operations-entrypoint", "node", "importer/cli.js"]
