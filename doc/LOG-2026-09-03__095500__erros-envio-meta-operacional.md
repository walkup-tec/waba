# LOG — Erros de envio Meta visíveis ao operacional

## Contexto do pedido

Depois da correção do relatório, evidenciar ao operador erros que impactam o envio. Entregue só vale com webhook `delivered`/`read`. HTTP 200 não prova entrega.

## Solução

- Webhook `failed` grava `errorCode` + `error_user_msg` no lead.
- Recusa do POST Graph grava código e texto público da Meta.
- Cada mudança de status entra em `statusLog` (append, não desce).
- Merge do JSON do disparo preserva trilha e erro, além de delivered/read.
- Relatório operacional (`GET /admin/operacional/campanhas/:id/relatorio`) devolve `sendIssues`: falhas (destino mascarado, código, motivo) e quantidade sem comprovante de entrega.
- UI do relatório operacional lista isso. Assinante e fórmulas da Alternativa não mudam.

Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components/ e https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast-send-issues.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-webhook-parser.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-webhook.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast.service.ts`
- `src/integrations/whatsapp/meta-cloud-provider.ts`
- `src/admin/waba-operacional-campanhas.service.ts`
- `index.html`
- testes phase5 e lab-report

## Como validar

```bash
npm run test:meta-lab-report
npm run test:meta-phase5
npm run test:meta-phase6
```

No operacional, abrir o relatório de uma campanha Lab: bloco de erros se houver falha; texto de “sem comprovante” se houver accepted sem delivered.

## Segurança

Destino mascarado na UI (`11 •••••-0317`). Sem token/PII extra nos logs.

## Palavras-chave

`sendIssues`, `errorCode`, `statusLog`, `131026`, `operacional`, `comprovante de entrega`
