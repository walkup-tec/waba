# LOG — Hex tamanho original + botão Aquecedor 3 fases

## Contexto

- Restaurar tamanho da imagem hexagonal (tinha sido reduzida ao alargar lanes).
- Botão Aquecedor: ícone à frente do texto; 3 fases (Iniciar verde / Aguarde azul / Pausar vermelho).

## Solução

- CSS hex: `max-width` 500px / 593px desktop; grid coluna hex como antes.
- `syncAquecedorMotorButton`: um botão com fases `start` | `waiting` | `pause`.
- `setWabaAquecedorLabelElement`: ícone sempre à esquerda (exceto `inlineInText`).

## Arquivos

- `index.html` / `dist/index.html`

## Palavras-chave

`syncAquecedorMotorButton`, `btn-aquecedor-wait`, `disparos-hex-cluster-art`
