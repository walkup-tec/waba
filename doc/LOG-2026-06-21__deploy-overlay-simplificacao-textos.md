# Overlay deploy — simplificação visual e novos textos

## Contexto

Usuário pediu menos elementos gráficos no modal de deploy: manter só círculo + barra, remover ícone nuvem, órbitas duplas e dots. Novo copy fixo com terceira linha em cor de destaque.

## Solução

- HTML: spinner circular simples + barra de progresso; removidos SVG, órbitas internas e dots.
- Textos:
  - `ATUALIZANDO O SISTEMA` (título verde)
  - `Estamos aplicando melhorias para oferecer uma experiência cada vez melhor.`
  - `Em poucos segundos sua tela será atualizada automaticamente...` (classe `.waba-deploy-overlay-accent`, cyan `#22d3ee`)
- `setOverlayPhase` só alterna classes CSS (`is-stabilizing`, `is-complete`); não troca mais o título dinamicamente.

## Arquivos alterados

- `index.html` — overlay deploy (JS inline + CSS)

## Palavras-chave

deploy overlay, waba-deploy-overlay, simplificação UI, atualizando sistema
