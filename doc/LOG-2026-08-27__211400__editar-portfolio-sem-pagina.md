# Falha ao editar portfólio (foto sem Página)

## Contexto do pedido

Mozart tentou Editar portfólio (`1041827648719609`, nome Drax Sistemas, arquivo DRAX.png) e o modal mostrou: *Não foi possível atualizar o nome ou a foto deste número na Meta.*

## Causa

A Meta não expõe escrita de `profile_picture_uri` no Business. A foto só pode ir para uma [Página](https://developers.facebook.com/docs/graph-api/reference/page/picture/). Este portfólio tem **Página principal: —**. O app fazia fallback para o `businessId` (`POST /{business-id}/photos`), a Graph recusava e o erro genérico falava em **número**.

Docs: [Update Business](https://developers.facebook.com/docs/marketing-api/business-manager/get-started/) (nome via POST `/{business-id}`), [Business fields](https://developers.facebook.com/docs/marketing-api/reference/business/).

## Solução

- Sem página: não chama Graph de foto; código `portfolio_photo_no_page` e texto claro
- Nome: POST JSON `{ name }` em vez de query
- UI: desabilita o seletor de foto e explica quando não há página
- Botões de número continuam com `profile_update_failed`

## Como validar

1. Laboratório → Editar portfólio sem página: foto bloqueada; mensagem sobre Página do Facebook
2. Só nome: Salvar deve chamar a Meta (pode falhar com 3910 se o token do ES não for admin do BM)
3. `npm run test:meta-portfolio`

## Palavras-chave

portfolio-edit, profile_picture_uri, primary_page, portfolio_photo_no_page, page picture
