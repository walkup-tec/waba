# Laboratório: carregar portfólios mais rápido

## Contexto do pedido

A tela de portfólios demorava muito para aparecer. Pedido: carregar o front dessa tela mais rápido.

## Causa raiz

`GET /integrations/meta/whatsapp/portfolio` esperava uma cascata sequencial na Graph **por conexão**, incluindo `fetchKnownBusinessPortfolios` (Drax + Walkup, 4–7 GETs cada) cujo resultado **não entra na lista**. Depois baixava fotos HTTPS antes de responder. O front ainda esperava `/status` e só então o `/portfolio`, com atraso de 400 ms e sem estado de loading.

## Ações executadas

- Parar de consultar BMs que não são da conexão listada
- Paralelizar Graph (me/businesses + BM; campos page/photo; conexões; nome+perfil do número)
- Não bloquear a lista no download de foto (usa cache local se já existir)
- Front: skeleton imediato; `/status` e `/portfolio` em paralelo
- `npm run test:meta-portfolio` — 38 ok
- `node scripts/copy-index-html.mjs` + tsc pontual

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio-graph.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- `index.html` / `dist/index.html`
- `src/deploy-marker.ts` / `dist/deploy-marker.js`

## Como validar

1. Após push + Redeploy: marker `DEPLOY-2026-08-30-172800-master-laboratorio-portfolio-fast`
2. Laboratório: skeleton aparece na hora; cards com nome/ID/página da Graph
3. Listar Drax não deve atrasar por GET do BM Walkup

## Segurança

Tokens não logados. Identidade continua vindo da Graph da conexão gravada.

## Palavras-chave

portfolio-fast, graph-waterfall, skeleton, Promise.all, fetchKnownBusinessPortfolios
