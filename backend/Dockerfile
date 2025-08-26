# Backend Dockerfile using the official Puppeteer image (includes Chromium + OS deps)
# See: https://github.com/puppeteer/puppeteer/tree/main/docker
FROM ghcr.io/puppeteer/puppeteer:22.12.1

# Set workdir
WORKDIR /app

# Copy manifests first for efficient caching (monorepo workspaces)
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package-lock.json* ./backend/
COPY frontend/package.json frontend/package-lock.json* ./frontend/

# Install all workspaces deps (dev deps included for build)
# If you don't have lockfiles for all workspaces, fallback to `npm install --workspaces` below.
RUN if [ -f package-lock.json ]; then npm ci --workspaces; else npm install --workspaces; fi

# Copy the rest of the repository
COPY . .

# Build only the backend
RUN npm run -w backend build

# Runtime configuration
ENV NODE_ENV=production
EXPOSE 3001

# Start the backend server
CMD ["node", "backend/dist/server.js"]
