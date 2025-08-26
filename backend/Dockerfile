# Backend Dockerfile using the official Puppeteer image (includes Chromium + OS deps)
# See: https://github.com/puppeteer/puppeteer/tree/main/docker
FROM ghcr.io/puppeteer/puppeteer:22.12.1

# Install dumb-init for proper process management as recommended by Puppeteer docs
USER root
RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*
USER pptruser

# Set workdir under the non-root user (pptruser) home
WORKDIR /home/pptruser/app

# Copy manifests first for efficient caching (monorepo workspaces)
COPY --chown=pptruser:pptruser package.json package-lock.json* ./
COPY --chown=pptruser:pptruser backend/package.json backend/package-lock.json* ./backend/
COPY --chown=pptruser:pptruser frontend/package.json frontend/package-lock.json* ./frontend/

# Install all workspaces deps (dev deps included for build)
# If you don't have lockfiles for all workspaces, fallback to `npm install --workspaces` below.
RUN if [ -f package-lock.json ]; then npm ci --workspaces; else npm install --workspaces; fi

# Copy the rest of the repository
COPY --chown=pptruser:pptruser . .

# Build only the backend
RUN npm run -w backend build

# Runtime configuration
ENV NODE_ENV=production
EXPOSE 3001

# Use dumb-init as entrypoint for proper process management
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/dist/server.js"]
