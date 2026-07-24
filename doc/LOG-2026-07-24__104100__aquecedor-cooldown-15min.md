# LOG — Aquecedor: cooldown de par 45 → 15 min

**Data:** 2026-07-24  
**Marker:** `DEPLOY-2026-07-24-aquecedor-cooldown-15min`

## Contexto

Após falha de confirmação de entrega (EVO aceita, WhatsApp do destino não confirma), o par A→B ficava em cooldown **45 minutos**. Pedido: reduzir para **15 minutos**.

## Alteração

- `DEFAULT_COOLDOWN_MS`: `45 * 60 * 1000` → `15 * 60 * 1000`
- Chamada em `runAquecedorCycle` (`recordDirectedDeliveryFailure`): mesmo valor explícito 15 min

Comportamento inalterado: durante o cooldown o par não é reescolhido; o ciclo segue com outros pares; ao expirar, o par volta a poder ser escolhido.

## Arquivos

- `src/aquecedor/delivery-cooldown.service.ts`
- `src/index.ts`
- `src/deploy-marker.ts`

## Validar

1. Redeploy Easypanel após push.
2. `/health` → `DEPLOY-2026-07-24-aquecedor-cooldown-15min`
3. Forçar falha de entrega em um par e conferir mensagem `Par em cooldown até …` (~15 min à frente).

## Palavras-chave

`aquecedor`, `cooldown`, `15 min`, `entrega`, `6635`, `8918`
