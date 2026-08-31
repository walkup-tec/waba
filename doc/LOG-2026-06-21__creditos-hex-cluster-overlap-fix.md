# LOG — Hex cluster compra: overlap e escala

## Contexto

Hexágonos grandes da tela Contratar estavam muito afastados e pareciam pequenos.

## Solução

- Cluster com dimensões fixas (`292×312px`, `318×340px` em telas ≥1100px).
- Hex grandes (`178px` / `194px`) sobrepostos ao hex central (`142px` / `154px`) em layout favo.
- Posicionamento por `left/top/bottom` em vez de `right` + `min-height` alto.
- Coluna do board alinhada ao cluster; lanes com `min-height` igual ao cluster.
- Badges reposicionados nas bordas dos hex coloridos.

## Arquivos

- `index.html`, `dist/index.html`

## Validar

Créditos → Contratar: três hex sobrepostos, maiores e mais próximos do mock.

## Palavras-chave

`disparos-pricing-hex-cluster`, `--disp-hex-lg`, honeycomb overlap
