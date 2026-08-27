# LOG — Editar nome e foto do portfólio Meta

## Contexto

Além dos números, o card do portfólio precisa de Editar para nome e foto.

## Solução

- Botão Editar no card do Business
- Nome: `POST /{business-id}?name=` ([Business Manager](https://developers.facebook.com/docs/marketing-api/business-manager/get-started/))
- Foto: não há campo de write em `profile_picture_uri`. Aplica na **página principal** (ou primeira de `owned_pages`) via [Page Picture](https://developers.facebook.com/docs/graph-api/reference/page/picture/)
- Rota: `POST /integrations/meta/whatsapp/portfolio/profile`

## Como validar

- Laboratório → Portfólio → Editar
- Nome deve mudar no card após salvar
- Foto: precisa de página no Business; sem página a UI avisa

## Palavras-chave

portfolio, business name, owned_pages, page picture, editar portfólio
