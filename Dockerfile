# MELTEK — LT CT core design system
# One Node service: the API serves the API and the built web app.

FROM node:22-bookworm-slim AS build
WORKDIR /app
# Puppeteer's Chromium is not needed to compile, only to render at runtime.
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json package-lock.json* ./
COPY packages/engine/package.json packages/engine/
COPY packages/schema/package.json packages/schema/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Chromium for the calculation-sheet PDF. The distro build is used rather than
# Puppeteer's download so the image gets security updates with the base image.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      chromium fonts-liberation fonts-dejavu-core ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package.json package-lock.json* ./
COPY packages/engine/package.json packages/engine/
COPY packages/schema/package.json packages/schema/
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev --workspace @meltek/api --include-workspace-root
COPY --from=build /app/packages/engine/dist packages/engine/dist
COPY --from=build /app/packages/schema/dist packages/schema/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/web/dist apps/web/dist

# The JSON store writes here when DATABASE_URL is unset. Mount a volume for it.
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
ENV PORT=3000 DATA_FILE=/app/data/meltek.json
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/server.js"]
