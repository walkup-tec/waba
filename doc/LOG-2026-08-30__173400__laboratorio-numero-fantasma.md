# Laboratório: não listar número fantasma da Drax

## Contexto do pedido

No portfólio Drax Sistemas o ID `1350439411479507` aparecia (Pendente, sem telefone). O número não existe e não deve ser exibido.

## Causa raiz

`mergePortfolioNumbers` juntava o `phone_number_id` gravado na conexão (ou um item PENDING da Graph sem `display_phone_number`) com os chips reais. A UI mostrava o ID cru quando não havia telefone.

## Solução

- Lista só números com telefone ou status CONNECTED.
- Se a Graph já devolveu chips reais, não acrescenta ID órfão da conexão.
- Front: não renderiza linha sem `displayPhoneNumber`.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.map.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- `index.html` / `dist/index.html`
- `src/deploy-marker.ts`

## Como validar

`npm run test:meta-portfolio` — 41 ok. Após push + Redeploy: Drax deve mostrar só o chip com telefone (ex. +55 51 8200-1279), sem `1350439411479507`. Marker: `DEPLOY-2026-08-30-173400-master-laboratorio-numero-fantasma`.

## Palavras-chave

1350439411479507, ghost phone, display_phone_number, mergePortfolioNumbers
