# syntax=docker/dockerfile:1
# Imagem de produção: Express em dist/; estado em /app/data (monte volume).
# Build: docker build -t waba:latest .
# Run:  docker run -p 3000:3000 --env-file .env -v waba-data:/app/data waba:latest

FROM node:20.18-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY index.html ./
COPY scripts/copy-index-html.mjs scripts/
COPY media ./media
COPY src ./src

RUN npm run build

FROM node:20.18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -g 1001 -S nodejs \
  && adduser -S nodejs -u 1001 -G nodejs

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data \
  && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/index.js"]
