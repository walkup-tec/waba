# LOG — Background sofisticado tela Contratar

## Contexto

Pedido: fundo com traços de luz/brilhos, camada blur transparente para suavizar, conteúdo atual por cima.

## Solução

Camadas em `#disparos-purchase-choice-wrap`:
1. `disparos-choice-backdrop-fx` — orbes verde/azul/violeta, arco cônico, traços, nós luminosos, mesh com máscara radial
2. `disparos-choice-backdrop-veil` — `backdrop-filter: blur(40px)` + overlay `rgba(11,17,27,0.34–0.5)`
3. `disparos-choice-content` — grid hex + lanes + benefícios (z-index 2)

## Arquivos

- `index.html`, `dist/index.html`

## Palavras-chave

`disparos-choice-backdrop`, `disparos-choice-backdrop-veil`, blur contratar
