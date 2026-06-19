# Fix — resumo Disparos jogava total na API Oficial

**Data:** 2026-06-12  
**Sintoma:** Mozart com 500+500 nos dados, UI mostrava Oficial 1.000 e Alternativa 0.

## Causa
`resolveDisparosCreditsApiBucket` em `index.html`: fallback legado atribuía `remainingShipments` (total) só à API Oficial quando `byApi` ausente (servidor antigo em memória).

## Correção
- Removido fallback que somava tudo em Oficial; usa apenas `byApi[kind]`.
- `npm run build` + reinício `dev:v02` na porta 3012.

## Dados Mozart (v02)
Backend: 500 Oficial + 500 Alternativa (confirmado via `getCreditsSummary`).

## Validação
Ctrl+F5 em Disparos → Resumo → 500 / 500.
