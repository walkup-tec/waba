# LOG — Hex cluster linhas de luz verde→azul

**Data:** 2026-06-21  
**Tipo:** ux  
**Palavras-chave:** hex cluster, linhas luz, créditos contratar, animação SVG

## Pedido

Efeito visual sobre a imagem dos hexágonos: linhas finas e delicadas, modernas, como luz sendo traçada de cima para baixo e de baixo para cima, contínuas, verde no topo e azul na base.

## Solução

- Wrapper `.disparos-hex-cluster-stage` com `aspect-ratio: 3000/4000`.
- Overlay SVG com **órbitas elípticas** (paths fechados, rotações distintas) envolvendo o cluster — estilo orbital/atômico, não linhas retas.
- Trechos de luz (`stroke-dasharray`) percorrem cada curva continuamente (sentido horário e anti-horário).
- Gradientes verde→azul e azul→verde ao longo do eixo vertical da arte.
- Filtro blur suave; `prefers-reduced-motion` desativa animação.

## Atualização (curvas orbitais)

Substituídas 12 linhas retas por 10 elipses inclinadas (`transform rotate`) com animação `disparosHexOrbitFlow`.

## Arquivos

- `index.html`, `dist/index.html`

## Validar

Créditos → Contratar: linhas animadas sobre `hexa-corrigi-2.png`, loop contínuo, sem bloquear cliques.
