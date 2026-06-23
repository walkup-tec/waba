# LOG — Preparando: promoção imediata sem depender do aquecedor

## Pedido

Após cumprir 6h e o status «em breve», a instância deve mudar para **conectado** imediatamente, **independente** do aquecedor estar ligado. Depois entra no ciclo de aquecimento quando o motor estiver ativo.

## Causa

`tickAquecedorStaggerPromotions()` só era chamado dentro de `runAquecedorCycle()` (e bloqueado por `nextAllowedAt`, expediente, etc.). Havia também cooldown global redundante que impedia promoção mesmo com `promoteAt` vencido.

## Solução

1. `tickAquecedorStaggerPromotions` — usa só `computePreparingPromoteAtMs` (remove bloqueio extra de 6h).
2. `syncAquecedorPreparingPromotions` — promove todas as instâncias elegíveis em lote.
3. Chamado em `getAquecedorLifecycleStatusMap()` (GET `/instancias/uso-config` e UI).
4. Timer no boot do servidor a cada **15s** — independente de `ENABLE_AQUECEDOR_PROCESSING`.

## Arquivos

- `src/services/aquecedor-instance-lifecycle.service.ts`
- `src/index.ts`

## Validação

- Instância em Preparando com `promoteAt` no passado → status **conectado** em até ~15s (ou ~1s se aba Instâncias aberta).
- Aquecedor desligado: promoção ocorre; envios só quando motor ligado e ≥2 ativos no ciclo.

## Palavras-chave

`preparando`, `em breve`, `syncAquecedorPreparingPromotions`, `promoteAt`
