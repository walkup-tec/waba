# Laboratório: vários portfólios Meta sem sobrescrever token

## Contexto do pedido

Corrigir Laboratório → Conexão (Portfólio Meta) em produção (`walkup-tec/waba` `master`). Drax sumia no refresh; Walkup sobrescrevia o token/WABA do Drax. Commit + push em `master`; Redeploy fica a cargo do usuário no EasyPanel.

## Causa raiz

- `findOpenByTenant` + `upsertPendingToken` tratavam uma conexão por tenant (`limit 1`) e atualizavam a linha `connected`.
- `exchangeCodeAndStore` gravava `META_BUSINESS_ID` do env (BM do tech provider) em todo signup.
- `attachSessionAssets` preferia `open.wabaId` (WABA antigo ganhava).
- `GET /portfolio` lia só essa conexão; Graph vazia apagava números.
- UI tinha um único card `#meta-tp-portfolio`.

## Solução

1. `listOpenByTenant` devolve todas as conexões abertas; `upsertPendingToken` só atualiza o mesmo `meta_business_id` ou o `pending_token` mais recente — nunca uma linha `connected` de outro portfólio.
2. Exchange grava `metaBusinessId: null`; o business vem do complete / `attachSessionAssets`.
3. Attach localiza por `businessId` incoming, senão `pending_token`; IDs incoming vencem os antigos.
4. `GET /portfolio` devolve `portfolios[]` + `portfolio`/`numbers` do selecionado. Graph vazia ou falha não-401 não apaga número gravado; nome da página cai no `verifiedName` persistido.
5. UI: um card por portfólio; clique seleciona (`?connectionId=`); números do selecionado.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-connection.repository.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.types.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.map.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-phase3.test.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- `index.html`
- `src/deploy-marker.ts`
- `dist/` correspondente

## Validação

- `npm run test:meta-phase3` — 14 pass
- `npm run test:meta-portfolio` — 28 pass
- Marker: `DEPLOY-2026-08-30-161900-master-laboratorio-multi-portfolio`

## Como validar após Redeploy

- `GET https://waba.draxsistemas.com.br/health` → `deployMarker` acima
- Laboratório/Conexão: Drax e Walkup visíveis; número Drax e página Drax Tecnologia e Sistemas não somem no Atualizar

## Palavras-chave

laboratorio, portfolio, meta, tech-provider, multi-portfolio, upsertPendingToken, listOpenByTenant
