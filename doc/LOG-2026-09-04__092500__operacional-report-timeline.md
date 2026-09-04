# Relatório operacional: linha do tempo igual ao assinante

## Contexto do pedido

Operacionais não viam a **linha do tempo** no relatório da campanha (ex.: Campanha Jandira 2). O assinante já tinha a trilha (criação → atendimento → aprovação do template → início/fim do disparo). Pedido: deixar o relatório operacional no mesmo padrão.

Também: explicar a lista “Erros que impactaram o envio” e se os **17** (sem comprovante) estão dentro dos **136 Falhados**.

## Sintoma

- Modal operacional (`/admin/operacional/campanhas/:id/relatorio`) sem bloco de timeline.
- Assinante (`collectIntakeReportTimeline`) já devolvia `timeline`.

## Causa

`getCampaignReport` no serviço operacional não incluía `timeline`. A UI só renderizava dashboard + `sendIssues`.

## Solução

1. Backend: `timeline: collectIntakeReportTimeline(intake)` no `getCampaignReport` (mesma função do assinante).
2. UI: host `#admin-campanhas-report-timeline` + `buildSubscriberCampaignTimelineHtml`.
3. Texto de `sendIssues` deixa claro: lista de códigos = Falhados; “N aceitas sem comprovante” = pendentes, **fora** de Falhados/Entregues.
4. Hints `131026` / `131042` alinhados à doc Meta.

Docs Meta: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/

## 17 vs 136 (Campanha Jandira 2)

| Bucket | Qtd (tela) | Significado |
|--------|------------|-------------|
| Falhados | 136 | Webhook `failed` / recusa Graph — entram no card **Falhados** |
| Aceitas sem comprovante | 17 | Meta aceitou (`accepted`/`sent`) sem `delivered`/`failed` ainda — **não** entram nos 136 |
| Entregues | 1.009 | Webhook `delivered`/`read` |
| Enviados (pendentes) no pizza | ~16 | Mesmo conceito dos 17 (arredondamento/atualização) |

Códigos da lista (fazem parte dos **136**):

- **131026** — Message Undeliverable (número sem WhatsApp, ToS, app antigo, bloqueio, etc.).
- **131042** — problema de pagamento/faturamento da WABA.

## Marker

`DEPLOY-2026-09-04-092500-operacional-report-timeline`

## Validação

- `npm run test:meta-lab-report` / `npm run test:campaign-report-timeline`
- Redeploy `waba_disparador` → `/health` com o marker → abrir relatório operacional Lab e ver “Linha do tempo”

## Arquivos

- `src/admin/waba-operacional-campanhas.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast-send-issues.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-lab-report.test.ts`
- `index.html`
- `src/deploy-marker.ts`

## Palavras-chave

timeline operacional, linha do tempo, sendIssues, pendingConfirmation, 131026, 131042, Jandira 2, Falhados vs pendentes
