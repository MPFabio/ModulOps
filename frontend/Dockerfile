# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Args pour Vite (optionnels : contournement Kong en cas de 502)
ARG VITE_API_BASE_URL
ARG VITE_AUTH_URL
ARG VITE_PIPELINE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_AUTH_URL=$VITE_AUTH_URL
ENV VITE_PIPELINE_URL=$VITE_PIPELINE_URL

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production stage
#
# Image non privilegiee : le chart impose runAsNonRoot, or nginx classique
# demarre en root pour se lier au port 80. Celle-ci ecoute sur 8080 et
# n'ecrit que sous /tmp.
FROM nginxinc/nginx-unprivileged:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
