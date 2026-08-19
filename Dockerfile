# Imagem de produção — SEM tsc no Docker (dist/ vem do Git; build local/CI antes do push).
# Motivo: tsc de src/index.ts (~320 KB) trava ou leva 30+ min em VPS com pouca RAM.
# Antes do push: npm run build && commit dist/ + src/deploy-marker.ts
#
# Chromium (Playwright) é necessário para Marketing · Leads PJ (Casa dos Dados).
# Base Debian slim: Alpine não traz o browser do Playwright de forma confiável.
#
# Run: docker run -p 3000:3000 --env-file .env -v waba-data:/app/data waba:latest

FROM node:20.18-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN groupadd --gid 1001 nodejs \
  && useradd --uid 1001 --gid nodejs --create-home --shell /usr/sbin/nologin nodejs

COPY package.json package-lock.json ./
RUN echo ">>> npm ci --omit=dev" \
  && npm ci --omit=dev --no-audit --no-fund \
  && echo ">>> playwright install chromium" \
  && npx playwright install --with-deps chromium \
  && echo ">>> npm/playwright OK"

COPY dist ./dist
COPY scripts ./scripts
COPY public-pages ./public-pages
COPY media/Drax-logo-footer.png media/drax-bets-logo.png media/favcon.png media/favicon.ico media/favicon.png media/compBoasvindasV3.jpg ./media/

RUN test -f dist/index.js || (echo "ERRO: dist/index.js ausente — rode npm run build antes do deploy" && exit 1)
RUN test -f dist/disparos/alternativa-dispatch-rules.js || (echo "ERRO: dist/disparos/alternativa-dispatch-rules.js ausente — rode npm run build e commit dist/" && exit 1)
RUN test -f /app/media/compBoasvindasV3.jpg || (echo "ERRO: capa boas-vindas ausente em /app/media" && exit 1)

RUN mkdir -p /app/data \
  && chown -R nodejs:nodejs /app /ms-playwright

USER nodejs

EXPOSE 3000

VOLUME ["/app/data"]

HEALTHCHECK --interval=45s --timeout=15s --start-period=90s --retries=5 \
  CMD node -e "const http=require('http');const req=http.get({host:'127.0.0.1',port:process.env.PORT||3000,path:'/live',timeout:8000},res=>process.exit(res.statusCode===200?0:1));req.on('timeout',()=>{req.destroy();process.exit(1)});req.on('error',()=>process.exit(1));"

CMD ["node", "dist/index.js"]
