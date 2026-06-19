# LOG — Disparos Dashboard menu

**Data:** 2026-06-08  
**Pedido:** Criar menu Dashboard dentro da seção Disparos.

## Alterações

- `src/menus/waba-menu-registry.ts` — entrada `disparos-dashboard` (section `oficial`, profile `production`).
- `index.html`:
  - Botão **Dashboard** no menu lateral (grupo Disparos) e drawer mobile.
  - Painel `#tab-disparos-dashboard` com KPIs (saldo, contratados, consumidos, campanhas).
  - `loadDisparosDashboard()` / `renderDisparosDashboardFromCache()`.
  - `setActiveTab`, `isOfficialTab`, `hasOfficialDisparosMenuAccess`, `hasStaffMenuAccess`, `refreshActiveTabData`.
  - CSS `.disparos-dashboard-*`.

## Permissões staff

- Menu `disparos-dashboard` no registry; usuários legados precisam habilitar no Admin **ou** já têm acesso implícito se possuem `campanhas` ou `disparos-lancamento`.

## Validação

- `npm run build` — OK (tsc + copy index.html).

## Pendências

- Deploy Easypanel (não solicitado).
- Evoluir dashboard com gráficos/ações rápidas conforme feedback.
