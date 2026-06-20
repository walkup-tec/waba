# Imagem de produção — SEM tsc no Docker (dist/ vem do Git; build local/CI antes do push).
# Motivo: tsc de src/index.ts (~320 KB) trava ou leva 30+ min em VPS com pouca RAM.
# Antes do push: npm run build && commit dist/ + src/deploy-marker.ts
#
# Run: docker run -p 3000:3000 --env-file .env -v waba-data:/app/data waba:latest

FROM node:20.18-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -g 1001 -S nodejs \
  && adduser -S nodejs -u 1001 -G nodejs

COPY package.json package-lock.json ./
RUN echo ">>> npm ci --omit=dev" \
  && npm ci --omit=dev --no-audit --no-fund \
  && echo ">>> npm ci OK"

COPY dist ./dist
COPY media/Drax-logo-footer.png media/favcon.png media/favicon.ico media/favicon.png ./media/

RUN test -f dist/index.js || (echo "ERRO: dist/index.js ausente — rode npm run build antes do deploy" && exit 1)

RUN mkdir -p /app/data \
  && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/index.js"]
