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

# ── Stage 2: Serve with Nginx ──
FROM nginx:alpine AS production

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config as template (envsubst replaces ${PORT} at startup)
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Railway injects PORT env var — default to 80 if not set
ENV PORT=80

# Only substitute PORT (not nginx's own $uri, $host, etc.)
ENV NGINX_ENVSUBST_FILTER=PORT

EXPOSE ${PORT}

CMD ["nginx", "-g", "daemon off;"]
