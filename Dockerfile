# syntax=docker/dockerfile:1.6

# ----------------------------------------------------------------------------
# Stage 1 — Build do bundle React/Vite
# ----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Vite injeta as variáveis VITE_* DURANTE o build (são embedded no JS).
# Por isso o Easypanel passa elas como --build-arg e nós precisamos
# convertê-las em ENV antes de rodar `npm run build`.
ARG VITE_API_BASE_URL
ARG VITE_API_TOKEN
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SUPABASE_VIDEOS_BUCKET
ARG VITE_SUPABASE_COVERS_BUCKET
ARG GIT_SHA

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_API_TOKEN=$VITE_API_TOKEN \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_SUPABASE_VIDEOS_BUCKET=$VITE_SUPABASE_VIDEOS_BUCKET \
    VITE_SUPABASE_COVERS_BUCKET=$VITE_SUPABASE_COVERS_BUCKET \
    GIT_SHA=$GIT_SHA \
    NODE_ENV=production \
    CI=true

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

RUN npm run build

# ----------------------------------------------------------------------------
# Stage 2 — Imagem final servindo o build estático com Nginx
# ----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
