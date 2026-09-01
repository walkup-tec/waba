# Modal de sucesso sem lista PENDING

## Contexto

No resultado positivo do envio, o modal listava «✓ Opção 1: PENDING» nas três opções. Pedido: não mostrar essa informação ali.

## Solução

O sucesso fica só com o texto (enviado à Meta, prazo de até 24 h, Atualizar da Meta). A lista por opção permanece apenas no envio parcial, quando alguma falhou.

## Arquivos

- `index.html`
- `src/deploy-marker.ts`

## Palavras-chave

modal, pending, sucesso, templates
