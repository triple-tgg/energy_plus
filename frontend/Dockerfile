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

# Copy nginx template (uses envsubst for BACKEND_URL)
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80

# nginx:alpine auto-runs envsubst on /etc/nginx/templates/*.template
# and outputs to /etc/nginx/conf.d/
CMD ["nginx", "-g", "daemon off;"]
