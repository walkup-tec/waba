# LOG — Foto de perfil do portfólio Meta

## Contexto

O card do portfólio em produção mostrava as iniciais **PE** no lugar da foto. Pedido: buscar a foto de perfil do Business e exibir no card.

## Causa

`GET /{business-id}` pedia só `id,name,primary_page{id,name}`. A Graph expõe a foto em `profile_picture_uri` no objeto Business.

Doc: https://developers.facebook.com/docs/marketing-api/reference/business/

## Solução

- Campos Graph: `id,name,profile_picture_uri,primary_page{id,name,picture}`
- Fallback: `picture.data.url` da página principal (ignora silhouette)
- Só HTTPS; se o campo extra falhar, nova leitura sem foto
- UI: `<img>` no avatar; sem foto da Graph (ou URL quebrada) usa `/media/meta-logo.png` (infinito Meta, Wikimedia)

## Como validar

- Laboratório → Conectar WhatsApp (Mozart)
- Avatar do card deve ser a foto do Business, não PE
- Sem foto na Meta: iniciais permanecem

## Palavras-chave

portfolio, profile_picture_uri, foto, Business Manager, Graph API
