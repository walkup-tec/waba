# Relatório operacional sem bloco de erros de envio

## Pedido

Retirar do relatório operacional a seção “Erros que impactaram o envio”. Manter a linha do tempo igual ao assinante. Tudo num push para deploy.

## Mudança

- UI: removidos o host e o renderer de `sendIssues`.
- API `GET /admin/operacional/campanhas/:id/relatorio`: deixa de devolver `sendIssues`.
- Mantidos dashboard (incl. Falhados) e `timeline` do assinante.

## Marker

`DEPLOY-2026-09-04-093000-operacional-report-sem-erros-envio`

## Validar

Redeploy EasyPanel `waba_disparador` → `/health` com o marker → relatório operacional sem lista de erros; com linha do tempo.
