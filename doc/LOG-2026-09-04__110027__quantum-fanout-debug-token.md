# Quantum — fan-out via debug_token (BM owned_* insuficiente)

## Contexto do pedido

Deploy do fix `DEPLOY-2026-09-04-102500-quantum-bm-waba-fanout` subiu no EasyPanel, mas o card **Quantum Smart Labs** (BM `3887084984861602`) continuou com badge **1** e só `+55 27 92836-1199`. Continuam ausentes:

- `+55 11 95213-1900`
- `+55 21 92368-3286`

## Sintoma observado

- UI pós-redeploy: ainda 1 número.
- Commit implantado tinha fan-out só por `/{bm}/owned_whatsapp_business_accounts` e `client_whatsapp_business_accounts`.

## Hipótese principal (confiança: Alta)

Token do Embedded Signup **não lista** (403/vazio) as edges secas `owned_*` / `client_*` do BM do cliente. Só a WABA gravada na conexão era hidratada → 1 chip.

Doc oficial (Embedded Signup — manage accounts): descobrir WABAs concedidas ao app via **`GET /debug_token`** → `data.granular_scopes[].target_ids` (com `access_token=APP_ID|APP_SECRET`).

## Solução implementada

1. `listWabaIdsFromDebugToken` — lê `granular_scopes` / `target_ids` de escopos `whatsapp_business*`.
2. Hydrate: **debug_token primeiro**, depois phones aninhados no BM / `me/businesses`, depois edges secas, depois `/{waba}/phone_numbers` paginado.
3. Log `portfolio-fanout` com `wabaCount` / `phoneRowCount`.
4. Marker `DEPLOY-2026-09-04-110500-quantum-fanout-debug-token` (src + dist).
5. Testes portfolio: 51 pass.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- `src/deploy-marker.ts`
- `dist/integrations/meta-whatsapp/meta-whatsapp-connection.service.js`
- `dist/deploy-marker.js`

## Como validar

1. Redeploy EasyPanel do `waba_disparador`.
2. `GET /health` → marker `DEPLOY-2026-09-04-110500-quantum-fanout-debug-token`.
3. Portfólios → Quantum: badge **3** se as WABAs SP/RJ estiverem em `debug_token.target_ids`.
4. Se continuar **1**: o app só recebeu 1 WABA no ES — conectar cada número com **+** (novo Embedded Signup) para o app ganhar as outras WABAs.

## Segurança

`META_APP_SECRET` só no servidor (app token `APP_ID|APP_SECRET`); tokens de usuário não entram na resposta pública.

## Palavras-chave

Quantum Smart Labs, debug_token, granular_scopes, target_ids, fan-out, owned_whatsapp_business_accounts, Embedded Signup, 3887084984861602, 95213-1900, 92836-1199, 92368-3286
