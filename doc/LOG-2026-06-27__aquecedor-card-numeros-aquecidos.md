# LOG — Card números aquecidos na Visão Geral do aquecedor

## Contexto

Pedido: na tela Visão Geral do aquecedor, exibir card gráfico com quantas instâncias estão aquecidas (ícone foguinho).

## Solução

Novo card **Números aquecidos** em `#tab-dashboard`:

- Conta instâncias com `useAquecedor` e `warmthLevel >= 1` (dados de `/instancias/uso-config`).
- Número grande + até 8 ícones 🔥 ativos (laranja).
- Subtexto: `X de Y no aquecedor · Total N · Médio N · Pouco N`.
- Borda esquerda laranja; grid da Visão Geral passou de 5 para 6 colunas (3 em telas médias).

Funções JS: `computeWarmthSummary`, `buildDashboardWarmthVisual`, `formatWarmthBreakdown`, `updateDashboardWarmthIndicators` (chamada em `updateInstancesIndicators`).

## Arquivos alterados

- `index.html` (HTML, CSS, JS)
- `dist/index.html` (build)

## Validar

1. Abrir **Aquecedor → Visão Geral**.
2. Card entre desconectadas e total de eventos.
3. Com instâncias no aquecedor e nível de aquecimento > 0, número e fogos aparecem.
4. Lista de instâncias já mostra fogos por linha — valores devem bater.

Palavras-chave: `aquecedor`, `warmthLevel`, `numeros aquecidos`, `visao geral`, `foguinho`
