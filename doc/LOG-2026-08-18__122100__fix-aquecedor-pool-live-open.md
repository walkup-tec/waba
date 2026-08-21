# Fix: aquecedor pool com connectionState vazio e chip duplicado

## Contexto do pedido

O número 5181076635 (instância Evolution `6635`, dono mozart.pmo@gmail.com) não entrava no ciclo automático do aquecedor. Teste manual 1261→6635 chegou no celular. Commit/push para `master`.

## Causa

1. `filterAquecedorRowsByEvoLiveOpen` exigia `connectionState === open`. Timeout/vazio era tratado como ghost.
2. `buildAquecedorChipIndex` mantinha a primeira instância do mesmo chip (`6035` ganhava de `6635`; `soma-9224` podia ganhar de `9224`).

## Solução implementada

- Manter a linha se o live-state for `open` ou vazio; só descartar `close`/`connecting`. Retry `fresh` se o primeiro fetch vier vazio.
- Deduplicar o pool por chip, preferindo o nome que coincide com o final do número.
- O índice chip→instância usa a mesma pontuação (não mais “primeira da lista”).

## Arquivos criados/alterados

- `src/instances/evo-connection-state.service.ts`
- `src/aquecedor/aquecedor-chip-identity.ts`
- `src/index.ts`
- `src/deploy-marker.ts`
- `dist/` correspondente
- Este LOG e `doc/memoria.md`

## Como validar

- `GET /health` com marker `DEPLOY-2026-08-18-aquecedor-pool-live-open`
- Snapshot `runtime-intent` do Mozart: `connectedSummary.names` inclui `6635`
- `logs_envios` com origem ou destino `6635` após o próximo ciclo
- Mensagem do aquecedor no WhatsApp 5181076635 (não reenviar probe manual)

## Observações de segurança

- Sem novos envios `sendText` neste passo. Sem segredos neste LOG.

## Palavras-chave

`6635` `6035` `5181076635` `aquecedor` `connectionState` `ghost-open` `chip` `dedupe`
