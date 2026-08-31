# LOG — Identidade visual menu por seção

**Data:** 2026-06-08  
**Pedido:** Cada seção do menu lateral com cor própria; item ativo herda a cor da seção (ex.: Admin amarelo, Suporte azul).

## Alterações

### `index.html` (CSS)
- Tokens `--menu-section-accent-rgb` por `data-menu-group`.
- Toggles: Aquecedor (laranja), Disparos/Campanhas (verde), Admin (amarelo), Suporte (azul).
- `.menu-group[data-menu-group] .tab-button.active` usa cor da seção (remove roxo genérico e verde global `integration-env-official`).
- Mobile: `.tab-button.active[data-menu-section="…"]` com borda inferior colorida.
- Labels mobile Admin/Suporte com `data-menu-section` e cores correspondentes.

### `index.html` (JS)
- `syncTabButtonMenuSections()` — define `data-menu-section` em todos `.tab-button[data-tab]`.
- `resolveMenuGroupForTab()` — retorna `suporte` para `admin-chamados`.
- `focusDesktopMenuGroupForActiveTab()` — inclui grupo `suporte`.

## Validação
- `npm run build` OK (tsc + copy-index-html).

## Pendências
- Deploy Easypanel não solicitado.
- Testar visualmente em `npm run dev:v02` (desktop sidebar + drawer mobile).
