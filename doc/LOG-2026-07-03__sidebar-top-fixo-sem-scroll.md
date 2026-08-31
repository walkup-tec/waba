# Sidebar — top fixo sem acompanhar scroll

## Problema

Menu lateral usava `getBoundingClientRect().top` do conteúdo principal, recalculado em resize/layout. Ao rolar a página, o `top` efetivo mudava e o menu “seguia” a barra de título.

## Solução

- `resolveWabaSidebarStackTopPx`: `rect.top + scrollY` → posição no documento, constante ao rolar.
- `position: fixed` com esse valor mantém o menu na mesma altura do viewport após o alinhamento inicial.
- Removido `transition` em `top` e observer de `#waba-main` (só header + strip de ambiente).
- Recalcula em resize e quando header/faixa de ambiente mudam de altura.

## Arquivo

- `index.html`

## Palavras-chave

`syncWabaSidebarStackTop`, `waba-sidebar-stack`, menu lateral fixo
