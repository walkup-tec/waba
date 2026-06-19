# LOG — Financeiro: refresh completo pelo header

**Data:** 2026-06-17

## Problema

No Admin → Financeiro, o botão **Atualização manual** (e o ciclo automático de 15s) só atualizava o timestamp do header. Métricas, split, status PIX e tabela de cobranças ficavam desatualizados.

## Correção

`carregar()` → `refreshActiveTabData()` quando a aba ativa não é Dashboard.

Para `admin-financeiro`, chama `loadAdminFinanceiro()` que recarrega:
- overview (métricas, integração Asaas, sync status transferências)
- config split / fornecedores / participantes
- settlements (rateio PIX)
- pedidos paginados

## Arquivos

- `index.html` — `refreshActiveTabData()`
- `src/deploy-marker.ts` — `DEPLOY-2026-06-17-financeiro-refresh-completo`
