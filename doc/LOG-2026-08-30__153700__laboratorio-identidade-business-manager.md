# LOG — Identidade do portfólio = Business Manager da Meta

## Contexto do pedido

Os prints da Meta mostram o dado oficial a copiar:

- Drax Sistemas / `1041827648719609` / Página principal: Drax Sistemas e Tecnologia / logo DRAX
- Grupo Walkup / `4141369862822598` / Página principal: Grupo Walkup / logo walkup

O Laboratório ainda não reproduzia esses campos.

## Causa raiz

O GET do Business pedia o campo `picture`, que não existe no nó Business da Graph (só `profile_picture_uri` e `primary_page`). A Graph rejeitava o pedido inteiro. O fallback omitia a foto. A página era preenchida com `verified_name` do WhatsApp, que não é a Página principal do BM.

## Solução

- Campos oficiais: `id,name,profile_picture_uri,primary_page{id,name,picture}`
- `GET me/businesses` (a mesma lista da suíte da Meta) e cruzar com a conexão
- Página: `primary_page`, depois `owned_pages` / `client_pages`
- Foto: `profile_picture_uri` do BM (não `/picture` do Business); cache local por Business ID
- Não usar `verified_name` do WhatsApp como nome ou página do portfólio

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.map.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio-identity.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- `src/deploy-marker.ts`

## Validação

- `npm run test:meta-portfolio` — 33 ok (inclui o caso Drax + Walkup iguais aos prints)
- Após Redeploy: marker `DEPLOY-2026-08-30-153700-master-laboratorio-identidade-bm`

## Palavras-chave

me/businesses, profile_picture_uri, primary_page, Business Manager, Drax Sistemas, Grupo Walkup
