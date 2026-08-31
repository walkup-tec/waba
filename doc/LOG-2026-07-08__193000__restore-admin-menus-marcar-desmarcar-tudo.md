# Restore — Marcar tudo / Desmarcar tudo (Menus liberados)

**Data:** 2026-07-08  
**Problema:** Botões sumiram após `git checkout HEAD -- index.html` (incidente restore-prod-hex-cluster); alteração nunca estava commitada no Git.

## Solução

Restaurados em **criar usuário** e **editar usuário** (Admin · Usuários):

- Botões **Marcar tudo** e **Desmarcar tudo** acima do checklist
- `applyAdminUserMenuChecklistBulk(container, checked)` — marca/desmarca checkboxes habilitados
- Toolbar oculta quando role = `master`

## Arquivos

- `index.html` (HTML, CSS, JS)
- `dist/index.html` via build

## Validar

Admin → Usuários → criar/editar usuário (não master) → botões visíveis e funcionais.

## Palavras-chave

`admin-user-menus`, marcar tudo, desmarcar tudo, menus liberados, bulk selection
