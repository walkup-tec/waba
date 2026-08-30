# Laboratório: foto do portfólio a partir da Meta

## Contexto do pedido

Grupo Walkup (`4141369862822598`) mostrava iniciais “GW” em vez da foto do Business Manager. Página vinha “—”.

## Causa raiz

1. `profile_picture_uri` da Graph muitas vezes traz `access_token`; o mapper descartava a URL para não vazar token no front — o card ficava sem foto.
2. Sem `primary_page`, não havia fallback de `/{page}/picture`.
3. O download da foto não era aguardado no GET `/portfolio`, então a resposta ia sem arquivo local.

## Solução

- Servidor baixa a URL (mesmo com token) e devolve `/portfolio/photo?businessId=`.
- Fallback `GET /{business-id}/picture`.
- Cache local revalida a cada 15 min para acompanhar troca na Meta.
- Token não vai para o HTML.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.map.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio-graph.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio-identity.store.ts`
- testes + marker

## Como validar

`npm run test:meta-portfolio` — 42 ok. Após push + Redeploy, Walkup deve mostrar a logo da Meta, não “GW”. Marker: `DEPLOY-2026-08-30-174000-master-laboratorio-foto-portfolio`.

## Palavras-chave

portfolio photo, profile_picture_uri, access_token, GW, Grupo Walkup, 4141369862822598
