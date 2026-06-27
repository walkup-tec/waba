# LOG — Hex cluster linhas de luz verde→azul

**Data:** 2026-06-21  
**Tipo:** ux  
**Palavras-chave:** hex cluster, linhas luz, créditos contratar, animação SVG

## Pedido

Efeito visual sobre a imagem dos hexágonos: linhas finas e delicadas, modernas, como luz sendo traçada de cima para baixo e de baixo para cima, contínuas, verde no topo e azul na base.

## Solução

- Wrapper `.disparos-hex-cluster-stage` com `aspect-ratio: 3000/4000`.
- Overlay SVG `.disparos-hex-light-lines` com 12 linhas inclinadas levemente.
- Gradientes `disparosHexLightGradDown` (verde→azul) e `disparosHexLightGradUp` (azul→verde).
- Animação `stroke-dashoffset` + fade (`disparosHexLightTraceDown` / `Up`), durações e delays escalonados.
- Filtro `feGaussianBlur` suave para glow.
- `prefers-reduced-motion`: linhas estáticas discretas.

## Arquivos

- `index.html`, `dist/index.html`

## Validar

Créditos → Contratar: linhas animadas sobre `hexa-corrigi-2.png`, loop contínuo, sem bloquear cliques.
