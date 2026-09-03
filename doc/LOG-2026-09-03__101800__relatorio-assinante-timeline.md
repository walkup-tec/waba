# LOG — Linha do tempo no relatório do assinante

## Contexto do pedido

Informar no relatório do assinante: criação da campanha, início do atendimento (Confirmar Início), aprovação do template pela Meta, início e fim do disparo. Formato: dia completo + `hh:mm:ss`. Aviso: a Meta pode demorar até 3 horas após o fim do disparo para finalizar a coleta e a exibição dos dados.

## Solução

- `GET /disparos/campanhas/intake/:id/relatorio` devolve `timeline` com os cinco marcos e `metaCollectionNote`.
- Criação = `intake.createdAt`. Início do atendimento = `intake.startedAt`.
- Início do disparo = `sendStartedAt` (quando o Cloud passa a `running`); campanhas antigas usam `createdAt` se já não estão na fila.
- Fim do disparo = `sendFinishedAt`.
- Aprovação do template: primeira vez que a Meta devolve `APPROVED` (webhook ou sync). O instante é gravado e não é sobrescrito. Campanhas antigas sem esse registro mostram "—".
- UI do overlay do assinante (`#dis-campaign-report-overlay`) lista a linha do tempo e o aviso das 3 horas. Operacional e fórmulas da Alternativa não mudam.

## Arquivos

- `src/disparos/waba-campaign-report-timeline.ts`
- `src/disparos/waba-campaign-intake.routes.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-approved-at.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-webhook-template.service.ts`
- `index.html`

## Como validar

```bash
npm run test:campaign-report-timeline
npm run test:meta-lab-report
```

Abrir o relatório de uma campanha finalizada no painel do assinante: os cinco horários e o aviso das 3 horas devem aparecer acima dos indicadores.

## Segurança

Sem PII extra. Datas em `America/Sao_Paulo`. Destinos de envio não entram neste bloco.

## Palavras-chave

`timeline`, `relatório assinante`, `sendStartedAt`, `templateApprovedAt`, `3 horas`, `Confirmar Início`
