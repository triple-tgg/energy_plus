# Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-slim AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
# Required at runtime by license seeding and by `npm run db:seed`
COPY --from=builder /app/scripts ./scripts
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
