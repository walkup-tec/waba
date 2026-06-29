# LOG — Card números aquecidos na Visão Geral do aquecedor

## Contexto

Pedido: na tela Visão Geral do aquecedor, exibir card gráfico com quantas instâncias estão aquecidas (ícone foguinho).

## Solução

Novo card **Números Aquecidos** em `#tab-dashboard`:

- Título **Números Aquecidos** (sem ícone no título).
- Três linhas fixas: nível 1 (1 🔥), nível 2 (2 🔥), nível 3 (3 🔥), cada uma com a quantidade de instâncias no aquecedor naquele `warmthLevel`.
- Dados de `/instancias/uso-config` via `computeWarmthSummary` + `updateDashboardWarmthIndicators`.

## Arquivos alterados

- `index.html` (HTML, CSS, JS)
- `dist/index.html` (build)

## Validar

1. Abrir **Aquecedor → Visão Geral**.
2. Card entre desconectadas e total de eventos.
3. Com instâncias no aquecedor e nível de aquecimento > 0, número e fogos aparecem.
4. Lista de instâncias já mostra fogos por linha — valores devem bater.

Palavras-chave: `aquecedor`, `warmthLevel`, `numeros aquecidos`, `visao geral`, `foguinho`
