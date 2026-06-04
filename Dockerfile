# STAGE 1: Build Frontend
FROM node:20-slim AS build-stage
WORKDIR /app
COPY package*.json ./
COPY server/postinstall.js ./server/
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install
COPY . .
RUN npm run build

# STAGE 2: Production Server
FROM mcr.microsoft.com/playwright:v1.48.0-jammy
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY server/postinstall.js ./server/
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install --omit=dev

# Copy backend and built frontend
COPY server ./server
COPY --from=build-stage /app/dist ./dist

# Configure environment
ENV PORT=3001
ENV NODE_ENV=production
ENV JWT_SECRET=automatizador-sunat-secret-key-change-me
EXPOSE 3001

# Create persistent data directories
RUN mkdir -p /app/server/data /app/output /app/descargas_cpe /app/descargas_buzon /app/sire /app/temp /app/uploads /app/logs

CMD ["node", "server/app.js"]
