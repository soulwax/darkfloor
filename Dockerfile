# File: Dockerfile

FROM node:25.2.0-alpine AS base
RUN apk add --no-cache libc6-compat postgresql-client
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Essential build args only - no redundant DB_* variables
ARG AUTH_SECRET
ARG AUTH_DISCORD_ID
ARG AUTH_DISCORD_SECRET
ARG NEXTAUTH_URL
ARG DATABASE_URL
ARG NODE_ENV
ARG BLUESIX_API_KEY
ARG API_V2_URL
ARG SKIP_ENV_VALIDATION=false

ENV AUTH_SECRET=${AUTH_SECRET}
ENV AUTH_DISCORD_ID=${AUTH_DISCORD_ID}
ENV AUTH_DISCORD_SECRET=${AUTH_DISCORD_SECRET}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV DATABASE_URL=${DATABASE_URL}
ENV NODE_ENV=${NODE_ENV}
ENV BLUESIX_API_KEY=${BLUESIX_API_KEY}
ENV API_V2_URL=${API_V2_URL}
ENV SKIP_ENV_VALIDATION=${SKIP_ENV_VALIDATION}

RUN npm run db:push || true
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm install -g pm2@5

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./public

RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/drizzle.env.ts ./drizzle.env.ts
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/src/server/db ./src/server/db
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/drizzle-kit ./node_modules/drizzle-kit
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/drizzle-kit ./node_modules/.bin/drizzle-kit
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/dotenv ./node_modules/dotenv

COPY --from=builder --chown=nextjs:nodejs /app/ecosystem.docker.cjs ./ecosystem.docker.cjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER nextjs

EXPOSE 3222

ENV PORT=3222
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/docker-entrypoint.sh"]
