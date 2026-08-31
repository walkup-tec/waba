# LOG — Contador regressivo status Preparando

**Data:** 2026-06-22  
**Marker:** `DEPLOY-2026-06-22-preparando-countdown-ui`

## Pedido

Ao lado de "Preparando", contador discreto mas visível com horas restantes até a instância entrar no ciclo do aquecedor.

## Implementação

- Backend: `computePreparingPromoteAtMs` considera 12h mínimo + fila (1 instância/12h).
- API `/instancias/uso-config`: campo `aquecedorPromoteAt` (ISO).
- UI tabela instâncias: badge `11h 42m 08s` com atualização a cada 1s.

## Validar

Instância em Preparando → coluna Status mostra label + contador; ao zerar, recarrega uso-config.
