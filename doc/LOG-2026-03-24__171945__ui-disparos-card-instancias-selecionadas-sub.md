# UI: card Instâncias selecionadas — subtítulo

## Pedido

No card **Instâncias selecionadas**, trocar o subtítulo de referência à “Seção 1 — round-robin entre elas” por **Total sendo utilizadas**.

## Alteração

- HTML inicial em `#disparos-selecionadas-sub`: texto sem “Seção 1”.
- `updateDisparosSelectedInstancesSummaryCard`: com seleção (`n > 0`) → **Total sendo utilizadas**; sem seleção → **Nenhuma selecionada · API usa todas elegíveis**.

## Arquivos

- `index.html` → `dist/index.html`
