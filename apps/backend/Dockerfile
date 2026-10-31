# ── Stage: Production Node.js Alpine Container for TrackHive Engine ──────────
FROM node:22-alpine

# Install OpenSSL for Prisma engine binary compatibility on Alpine Linux
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production and development dependencies needed for Prisma generation
RUN npm install

# Copy Prisma schema and generate Prisma client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy application source code
COPY . .

# Expose TrackHive API and Socket.io port
EXPOSE 5000

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=5000

# Start server
CMD ["npm", "start"]
