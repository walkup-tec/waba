# Campanha: balanço por chip e proxy do 5401

## Contexto do pedido

Após o deploy, só um número parecia enviar. Pedido: corrigir e melhorar o balanço entre os chips selecionados.

## Causa

1. O delay (2–5 min) era **da campanha inteira**: um envio de um chip bloqueava os outros.
2. Lead com imagem sem `DELIVERY_ACK` ficava na frente da fila e prendia o mesmo chip.
3. `GET /proxy/find` com corpo `null` gravava cache `false` **depois** de um `proxy/set` ok — o WB-5401 (`walkup-5401`) saía do pool. Doc Evolution: find devolve a config ou 404/vazio se ainda não há linha ([set-proxy](https://docs.evolutionfoundation.com.br/en/evolution-api/set-proxy)).

## Solução

- Cooldown **por instância**; o tick (7s) pode usar o próximo chip imediatamente.
- Pick pelo **menor número de envios desta campanha** (empate: ordem da seleção).
- Leads novos (sem `mediaMessageId`) passam na frente dos que esperam ACK da imagem.
- ACK da imagem sem entrega: retry só daquele chip (~12s), não da campanha.
- `proxy/find` lê `enabled` aninhado (`proxy.enabled`); `proxy/set` ok não é apagado por find nulo; reconcile trata a lista selecionada como “na campanha”.

## Arquivos

- `src/proxy/proxy-brasil-campaign.rules.ts` (+ selfcheck)
- `src/proxy/evo-instance-proxy.service.ts`
- `src/index.ts`
- `src/deploy-marker.ts` → `DEPLOY-2026-08-27-campanha-balanco-por-chip`
- `dist/` correspondente (tsc emitiu mesmo com erro Playwright pré-existente)

## Como validar

- Selfcheck: `node dist/proxy/proxy-brasil-campaign.rules.selfcheck.js` → `proxy-brasil-campaign.rules ok`
- Após Redeploy: `/health` com o marker acima
- Em ~1 minuto os chips com proxy devem enviar intercalados; 5401 só entra se o proxy ligar

## Segurança

Sem `sendText` de teste. Sem log de senha do proxy.

## Palavras-chave

campanha, balanço, round-robin, cooldown por chip, walkup-5401, proxy/find, ACK imagem
