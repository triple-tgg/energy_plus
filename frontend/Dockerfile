# ── Stage 1: Build ──
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts 2>/dev/null || npm install
COPY . .

# Backend API URL injected at build time
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# ── Stage 2: Serve with lightweight Node server ──
FROM node:20-slim AS production
WORKDIR /app

RUN npm install -g serve@14

# Copy built files
COPY --from=build /app/dist ./dist

EXPOSE ${PORT:-3000}

# serve listens on $PORT automatically, -s enables SPA fallback
CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
