# LOG — Campanhas antigas voltam API Oficial

**Data:** 2026-06-12

## Sintoma
Campanhas históricas (Campanha 01–06, Final, etc.) apareciam como **Disparo API Alternativa** após créditos Alternativa no assinante.

## Causa
`resolveIntakeApiKind` sem `apiKind` no intake usava o **último pedido pago** do assinante (Alternativa), retroagindo em todas as campanhas.

## Correção
- `resolveSubscriberDispatchesApiKindFromOrdersAt(email, createdAt)` — plano na data de criação da campanha.
- `waba-operacional-campanhas.service.ts` usa criação do intake no fallback.
- Backfill `apiKind: oficial` nos intakes legados (exceto API Alternativa 01/02).

## Validação
Master → Campanhas: 7 campanhas **API Oficial**; 2 **API Alternativa**.
