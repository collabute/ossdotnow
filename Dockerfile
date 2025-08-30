# Stage 1: Base image with Bun
FROM oven/bun:1.2.19-alpine AS base

# Stage 2: Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY packages/api/package.json ./packages/api/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/
COPY packages/env/package.json ./packages/env/
COPY packages/ui/package.json ./packages/ui/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Install dependencies using bun
RUN bun install --frozen-lockfile

# Stage 3: Build the application
FROM base AS builder
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy dependencies from deps stage (Bun uses a single node_modules at root)
COPY --from=deps /app/node_modules ./node_modules

# Copy all source code
COPY . .

# Set build arguments with placeholder values for build-time validation
# These will be overridden at runtime with actual values
ARG VERCEL_ENV=production
ARG VERCEL_PROJECT_PRODUCTION_URL=http://localhost:3000
ARG DATABASE_URL=postgresql://placeholder:placeholder@placeholder:5432/placeholder
ARG UPSTASH_REDIS_REST_URL=https://placeholder.upstash.io
ARG UPSTASH_REDIS_REST_TOKEN=placeholder
ARG GITHUB_CLIENT_ID=placeholder
ARG GITHUB_CLIENT_SECRET=placeholder
ARG GITHUB_TOKEN=placeholder
ARG GITLAB_CLIENT_ID=placeholder
ARG GITLAB_CLIENT_SECRET=placeholder
ARG GITLAB_ISSUER=https://gitlab.com
ARG GITLAB_TOKEN=placeholder
ARG SENTRY_DSN=https://placeholder@sentry.io/0
ARG DATABUDDY_CLIENT_ID=placeholder
ARG CRON_SECRET=placeholder
ARG NEXT_PUBLIC_VERCEL_ENV=production
ARG NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL=http://localhost:3000
ARG NEXT_PUBLIC_SENTRY_DSN=https://placeholder@sentry.io/0

# Set environment variables for build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT_STANDALONE=true
ENV VERCEL_ENV=$VERCEL_ENV
ENV VERCEL_PROJECT_PRODUCTION_URL=$VERCEL_PROJECT_PRODUCTION_URL
ENV DATABASE_URL=$DATABASE_URL
ENV UPSTASH_REDIS_REST_URL=$UPSTASH_REDIS_REST_URL
ENV UPSTASH_REDIS_REST_TOKEN=$UPSTASH_REDIS_REST_TOKEN
ENV GITHUB_CLIENT_ID=$GITHUB_CLIENT_ID
ENV GITHUB_CLIENT_SECRET=$GITHUB_CLIENT_SECRET
ENV GITHUB_TOKEN=$GITHUB_TOKEN
ENV GITLAB_CLIENT_ID=$GITLAB_CLIENT_ID
ENV GITLAB_CLIENT_SECRET=$GITLAB_CLIENT_SECRET
ENV GITLAB_ISSUER=$GITLAB_ISSUER
ENV GITLAB_TOKEN=$GITLAB_TOKEN
ENV SENTRY_DSN=$SENTRY_DSN
ENV DATABUDDY_CLIENT_ID=$DATABUDDY_CLIENT_ID
ENV CRON_SECRET=$CRON_SECRET
ENV NEXT_PUBLIC_VERCEL_ENV=$NEXT_PUBLIC_VERCEL_ENV
ENV NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL=$NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

# Build the application
RUN bun run build

# Stage 4: Production image
FROM base AS runner
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone build (Next.js generates the entire app structure)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Copy static files and public directory
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Switch to non-root user
USER nextjs

# Expose the application port
EXPOSE 3000

# Health check (optional - remove if you don't have a health endpoint)
# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#   CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Start the application using the standalone server
CMD ["bun", "run", "apps/web/server.js"]
