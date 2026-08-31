# LOG — 2026-08-28 — + Instâncias substitui o número bloqueado

## Contexto do pedido

Clique em «+ Instâncias» na campanha Corbans para substituir WB-2477 (bloqueada). A API respondeu `409` com `code: buy_numbers_required` e `needsPurchase: true`. A tela já dizia que havia número conectado livre.

## Causa raiz

`GET /health` em produção = `DEPLOY-2026-08-28-083300-keep-pairing-chip-live`. O Docker **não** recebeu o commit `acb116d` (`090000`). No 083300, se o probe live do spare falha, o POST devolve `buy_numbers_required` e o HTML antigo abre a aba Comprar.

GET e POST também usavam listas diferentes: GET conta spare em `evoRowsAll`; POST media saúde em `evoRows` filtrado (`connectedCount: 2` no POST vs 1 vermelho na UI).

## Solução implementada

1. POST auto usa a **mesma lista de spare da UI** (`listConnectedSpareEvoNames`). Sem `buy_numbers_required`.
2. Saúde e offline em `evoRowsAll` (igual ao GET).
3. Inclusão **substitui** o vermelho (2477) 1:1; não tira chip verde (7770).
4. HTML: 409 **não** redireciona para comprar números.
5. Marker: `DEPLOY-2026-08-28-093700-instancias-substitui-bloqueada`.

## Arquivos criados/alterados

- `src/index.ts`, `src/deploy-marker.ts`, `index.html`
- `dist/index.js`, `dist/index.html`, `dist/deploy-marker.js`
- `doc/memoria.md`, `.cursor/project-memory/*`

## Como validar

- Após Redeploy `waba_disparador`: `GET /health` = `DEPLOY-2026-08-28-093700-instancias-substitui-bloqueada`.
- «+ Instâncias»: POST 200; chip 2477 sai; spare entra; 7770 permanece se estiver verde.
- Network: resposta **sem** `buy_numbers_required`.

## Observações de segurança

Push Git ≠ Docker. Sem Redeploy EasyPanel o marker continua `083300`.

## Palavras-chave

+ Instâncias, buy_numbers_required, WB-2477, spare, evoRowsAll, substitui bloqueada
