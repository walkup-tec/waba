# LOG — Campanha: 1 envio por chip + Proxy em todos os selecionados

## Contexto do pedido

Rodízio 2477 → 5401 → 7770 → 9224 (1 mensagem cada, depois repete). Os 4 selecionados precisam disparar. WB-5401 (`walkup-5401`) estava `open` com `/proxy/find` null e saía do pool.

## Causa

- Round-robin global (`__global_rr__`) só entre quem já estava elegível; chip sem proxy nunca recebia vez.
- Tick da campanha reconcilia Proxy com `allowEnable: false`, então 5401 nunca ganhava `proxy/set`.

## Solução

1. Cursor por `campaignId` na ordem de `selectedDisparadorInstances`; 1 envio no próximo chip ativo; inativo é pulado e tentado no ciclo seguinte.
2. Tick/paused passam a ligar Proxy Brasil em selecionada `open` sem `/proxy/find` enabled (sem restart se a sessão continuar open).
3. Lead com imagem pendente de botão permanece no mesmo chip (`mediaInstanceName`).

## Arquivos

- `src/proxy/proxy-brasil-campaign.rules.ts`
- `src/index.ts`
- `src/deploy-marker.ts`
- `dist/` correspondente
- `doc/memoria.md`

## Como validar

1. `node dist/proxy/proxy-brasil-campaign.rules.selfcheck.js` → ok
2. Após Redeploy: `GET /health` marker `DEPLOY-2026-08-26-campanha-rr-1-por-chip`
3. `GET /proxy/find/walkup-5401` → `enabled: true` (após o primeiro tick/Ativar)
4. Logs: instâncias intercaladas 2477, walkup-5401, drax, 9224

## Observações de segurança

Sem `sendText` de probe. Proxy aplicada só em instância selecionada e `open`.

## Palavras-chave

round-robin, 1 por chip, walkup-5401, Proxy Brasil, allowEnable, campanha Corbans
