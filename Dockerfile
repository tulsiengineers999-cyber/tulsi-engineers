# ── deps ──────────────────────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=1
RUN npm ci --ignore-scripts

# ── build ─────────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# A database URL is required at build time only to satisfy Prisma's client
# generation; the real one is supplied at runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── runtime ───────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app
# Chromium is needed for server-side PDF generation. Set PDF_DRIVER=HTML to
# drop this layer and serve print-ready HTML instead.
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates chromium fonts-liberation fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    CHROMIUM_PATH=/usr/bin/chromium \
    PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/package.json ./package.json

RUN useradd -m -u 1001 tulsi && mkdir -p /app/storage && chown -R tulsi:tulsi /app
USER tulsi

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]
