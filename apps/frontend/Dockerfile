# ── Stage 1: Build React Vite SPA ───────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install frontend dependencies
RUN npm install

# Copy frontend source code
COPY . .

# Build production artifacts (outputs to /app/dist)
RUN npm run build

# ── Stage 2: Serve with lightweight Nginx Alpine ────────────────────────────
FROM nginx:alpine

# Copy built static files to Nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration supporting React client-side routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose standard HTTP port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
