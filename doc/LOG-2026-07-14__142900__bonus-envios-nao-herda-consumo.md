# LOG — Bônus Envios não herda dívida de consumo

**Data:** 2026-07-14  
**Pedido:** creditou 1000, mostrou 830 (descontou uso antigo). Bônus não pode ser debitado do já utilizado.

## Causa
`Disponíveis = contratado − consumido` misturava consumo antigo com grants `admin-bonus-envios`.

## Correção
- Disponível = `max(0, pago − consumido) + max(0, bônusAdmin − bonusConsumed)`
- Consumo novo: primeiro saldo pago; só o excedente incrementa `bonusConsumed*`
- Dívida antiga (consumo sem saldo pago) não reduz o bônus creditado

## Arquivos
- `src/billing/waba-disparos-credits.service.ts`
- `src/billing/waba-disparos-credit-usage.repository.ts`

## Validar
Mozart: crédito 1000 admin Oficial → Disponíveis Oficial sobe **+1000** (não 1000−uso antigo)

## Keywords
`bonus-envios`, `bonusConsumed`, Dívida consumo, Disponível
