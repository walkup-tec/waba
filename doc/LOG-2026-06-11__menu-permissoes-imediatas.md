# LOG — Permissões de menu com efeito imediato

**Data:** 2026-06-11

## Sintoma

Master removeu menu Disparos de `operacional@teste.walkup.com`; após F5 o usuário ainda acessava Disparos/Campanhas.

## Causa raiz

1. Permissões separadas: `disparos-lancamento` (rótulo "Disparos") e `campanhas` — só o primeiro estava desmarcado.
2. `hasCampanhasMenuAccess()` ignorava permissões de staff e mostrava Campanhas só por créditos.
3. Fallback de aba bloqueada redirecionava para `disparos-lancamento` com `skipPolicyCheck`.
4. Sessão do usuário logado não era revalidada sem novo login.

## Correções

- `waba-menu-permissions.service.ts`: sem `disparos-lancamento` → `campanhas` efetivo = false (leitura e gravação).
- `index.html`: Campanhas exige permissão; `resolveFirstAllowedStaffTab()`; refresh de sessão no foco e a cada 45s; ao desmarcar Disparos no admin, desmarca Campanhas.

## Validação

`operacional@teste.walkup.com` → `allowedMenuIds: []`, `campanhas: false` (efetivo) sem re-salvar usuário.
