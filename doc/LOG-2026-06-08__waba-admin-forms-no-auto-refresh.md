# LOG — Pausar auto-refresh em Admin Usuários e Financeiro

**Data:** 2026-06-08  
**Deploy marker:** `DEPLOY-2026-06-08-waba-admin-forms-no-auto-refresh`

## Problema

O `carregar()` a cada 15s chamava `refreshActiveTabData()` → `loadAdminUsers()` / `loadAdminFinanceiro()`, re-renderizando formulários e apagando dados em cadastro (usuários master, split financeiro).

## Solução

- Abas `admin-usuarios` e `admin-financeiro` pausam o timer global de 15s.
- `refreshActiveTabData()` ignora essas abas.
- Label: «Atualização automática pausada nesta tela».
- Botões **Atualizar** de cada painel continuam funcionando manualmente.
- Ao trocar de aba, o timer automático volta nas demais telas.

## Arquivo

- `index.html`

## Pendência

- Commit/deploy quando usuário solicitar.
