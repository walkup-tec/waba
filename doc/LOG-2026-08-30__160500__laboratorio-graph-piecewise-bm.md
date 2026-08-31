# Laboratório: identidade do portfólio só com o que a Graph devolver

## Contexto do pedido

O título «Drax Sistemas» no card não veio da Meta. Foi gravado antes pelo botão Editar. O Laboratório precisa requisitar a Graph e só exibir nome, ID e página se a Meta devolver. Portfólios oficiais:

- Drax Sistemas — `1041827648719609` — página `Drax Sistemas e Tecnologia`
- Grupo Walkup — `4141369862822598` — página `Grupo Walkup`

Não publicar até a Meta devolver esses objetos.

## Ações

- Parar de aplicar o nome local do Editar no GET `/portfolio`
- GET piecewise na Graph (`id,name`, depois `primary_page`, depois `profile_picture_uri`) para não um campo inválido derrubar o objeto inteiro
- GET dos IDs oficiais; card só entra se a resposta tiver `id` + `name` (não inventar)
- Testes unitários com Graph simulada (`npm run test:meta-portfolio`, 37 ok)
- Marker: `DEPLOY-2026-08-30-161300-master-laboratorio-graph-piecewise`

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio-graph.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.map.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`

## Como validar

1. `npm run test:meta-portfolio`
2. Depois de autorizado o push + Redeploy: Laboratório deve mostrar os dois BMs **somente** se `GET /{id}?fields=id,name` e `primary_page` da Meta responderem. Marker ainda não bumpado.

## Segurança

Tokens da Graph não logados. Nome digitado no Editar não substitui a Graph.

## Palavras-chave

graph piecewise, business manager, 1041827648719609, 4141369862822598, Drax Sistemas, Grupo Walkup, Editar overlay, primary_page
