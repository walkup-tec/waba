# Relatório Lab — não fechar JSON só com aceite Graph

Data: 2026-09-09 20:48 UTC
Disparo de referência: Campanha Jandira 2 (03/09/2026 15:51:19, Cleison)

## Sintoma

O relatório finalizava com entregues/lidos zerados mesmo quando a Meta ainda ia enviar `statuses` (delivered/read). O JSON da campanha era tratado como fechado.

## Causa (já documentada em 02/09, ainda incompleta)

1. Graph 200 é só aceite. Entregues/lidos vêm do webhook.
2. Em 02/09 o teto de 2 h ainda fechava o relatório com todos os leads em `accepted`/`sent`.
3. Na Jandira 2 o processo também morreu no Redeploy; o teto de 2 h agravava o fechamento cedo.

## Correção desta data

Marker: `DEPLOY-2026-09-09-204800-lab-report-wait-meta-statuses`

- Teto de coleta: **3 horas** (alinhado ao aviso da UI).
- Relatório **não finaliza** enquanto todos os envios aceitos estiverem só em `accepted`/`sent`.
- Fecha após 15 min de silêncio quando já existe delivered/read **ou** todos os envios têm status terminal Meta (delivered, read ou failed).
- O teto de 3 h só fecha se a Meta já tiver enviado pelo menos um status terminal.
- Webhook tardio continua atualizando relatório já finalizado (`refreshCompletedLabIntakeReport`).
