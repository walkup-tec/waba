# LOG: modal campanha — Mapear Arquivo e botão confirmar

## Contexto

No modal de mapeamento da planilha da campanha, ao clicar em criar campanha nada parecia ocorrer e o modal permanecia aberto.

## Causas prováveis tratadas

- Select de colunas montado com `innerHTML` e nomes de coluna com caracteres especiais (`<`, `&`, aspas) podiam corromper o markup e deixar o valor da coluna vazio ou inválido.
- Nome da campanha só no formulário principal: validação falhava sem destaque se o usuário preenchesse só no fluxo do modal ou não visse o toast.
- Garantia de clique: ações de Cancelar / Confirmar passam por delegação no overlay (além de remover listeners duplicados).

## Solução

- Título do modal: **Mapear Arquivo**; texto de ajuda atualizado.
- Campo **Nome da campanha** dentro do modal (sincronizado com `dis-campaign-name` ao abrir; gravado de volta no principal após sucesso).
- Opções do `<select>` criadas via `createElement`/`appendChild` (valores seguros).
- Botão: **Confirmar e criar campanha**; handler unificado no `#dis-campaign-mapping-overlay` com `void createCampaignFromMappedSpreadsheet()`.

## Arquivos

- `index.html` (e `dist/index.html` via `npm run build`)

## Como validar

1. Importar Excel, abrir mapeamento, preencher nome e coluna, confirmar — campanha criada, modal fecha, toast e lista à direita atualizada.
2. Colunas com nomes “esquisitos” ainda devem aparecer corretamente no select.

## Palavras-chave

`mapear-arquivo`, `dis-campaign-mapping-overlay`, `createCampaignFromMappedSpreadsheet`, `dis-campaign-modal-name`
