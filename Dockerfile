# syntax=docker/dockerfile:1
# Copyright 2025-2026 Alexander J. Sánchez T.
# SPDX-License-Identifier: LicenseRef-Proprietary

# LedgerCore Console — multi-stage build with Next.js standalone output.
# Build context = this repository root:
#   docker build -t ledgercore/console .

FROM node:26-alpine AS base
RUN npm install -g pnpm@11
WORKDIR /app

# --- dependencies ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . ./
# CI=true stops pnpm's deps-status check from trying to purge node_modules
# (no TTY inside docker build -> ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY).
#
# verify-deps-before-run=false is load-bearing: pnpm >= 11.20 re-verifies the
# store before running a script and, on any drift, silently starts a SECOND
# install inside `pnpm build`. That install hits the network and can hang
# indefinitely (observed 2026-08-04: three builds stuck with zero CPU right
# after "Done in 22.2s"). node_modules already arrived from the deps stage;
# there is nothing left to install here.
ENV NEXT_TELEMETRY_DISABLED=1 \
    CI=true \
    npm_config_verify_deps_before_run=false
# Invoke Next directly instead of `pnpm build`: running it as a pnpm SCRIPT is
# what triggers the deps re-verification above, and neither CI=true nor the
# env-var form of the setting suppresses it in pnpm 11.20 (both were tried on
# 2026-08-04; the implicit install hung with zero CPU every time). node_modules
# came from the deps stage against the frozen lockfile, so there is nothing to
# verify — go straight to the compiler.
RUN node_modules/.bin/next build

# --- runtime ---
FROM node:26-alpine AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
