# LOG — Preparando: intervalo 12h → 6h

**Data:** 2026-06-22  
**Marker:** `DEPLOY-2026-06-22-aquecedor-preparando-6h`

## Pedido

Reduzir tempo mínimo em **Preparando** e fila de promoção de **12h** para **6h**.

## Alteração

- `AQUECEDOR_STAGGER_PROMOTE_MS`: `6 * 60 * 60 * 1000` em `aquecedor-instance-lifecycle.service.ts`
- Mensagem runtime aquecedor: "liberação gradual a cada **6h**"

## Comportamento

- Instância nova: mínimo **6h** em `preparing` antes de poder virar `active`
- Fila: no máximo **1 promoção a cada 6h** (`lastStaggerPromotionAt`)
- Contador UI (`aquecedorPromoteAt`) recalcula com a nova constante

## Validar

1. Instância em Preparando → contador ~6h após `preparingSince` (mais fila se houver outras na frente)
2. Após 6h + slot da fila → status **conectado** (active no aquecedor)

## Palavras-chave

preparando, 6h, stagger, AQUECEDOR_STAGGER_PROMOTE_MS
