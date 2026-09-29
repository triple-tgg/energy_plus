# ── Stage 1: Build Frontend ──
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend

# Accept build-time version args
ARG APP_VERSION=dev
ARG GIT_SHA=unknown

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --ignore-scripts 2>/dev/null || npm install
COPY frontend/ ./

# Inject version into Vite build via env vars
ENV VITE_APP_VERSION=${APP_VERSION}
ENV VITE_GIT_SHA=${GIT_SHA}
RUN npm run build

# ── Stage 2: Build Backend ──
FROM node:20-slim AS backend-build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --ignore-scripts 2>/dev/null || npm install
COPY backend/ ./
RUN npx tsc

# ── Stage 3: Production ──
FROM node:20-slim AS production

# Accept build-time version args for runtime env
ARG APP_VERSION=dev
ARG GIT_SHA=unknown

WORKDIR /app

# Set version as runtime env for backend
ENV APP_VERSION=${APP_VERSION}
ENV GIT_SHA=${GIT_SHA}

# Copy backend production deps
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts 2>/dev/null || npm install --omit=dev

# Copy compiled backend
COPY --from=backend-build /app/backend/dist ./dist

# Copy backend scripts
COPY --from=backend-build /app/backend/scripts ./scripts

# Copy frontend static files
COPY --from=frontend-build /app/frontend/dist ./public

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/api/v1/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

EXPOSE ${PORT:-3000}

CMD ["node", "dist/server.js"]
