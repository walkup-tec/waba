# LOG — Remove aviso de filtro Ativo no modal de envio

## Contexto

O modal após enviar templates à Meta trazia o texto: envio fica em análise, não em Ativo, e para tirar o filtro de modelos ativos no WhatsApp Manager. Pedido: tirar, desnecessário.

## Solução

Removido o parágrafo em `metaTplAiSubmitResultHtml`. Permanecem a lista de cada template e o portfólio/WABA.

## Arquivos

- `index.html`
- `src/deploy-marker.ts`

## Como validar

Enviar as três opções: o modal de sucesso não mostra o aviso sobre filtro Ativo.

## Palavras-chave

modal, filtro ativos, análise, Enviar para META
