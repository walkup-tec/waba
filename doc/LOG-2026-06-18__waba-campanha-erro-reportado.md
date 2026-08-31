# LOG — reportar erro campanha operacional

**Data:** 2026-06-18

## Pedido
- Remover "Linhas importadas" do modal operacional.
- Botão "Reportar Erro" com justificativa.
- Status assinante: "Erro Reportado"; botão "Motivo do Erro".
- Restituir saldo (`plannedSendCount`) ao reportar erro.
- E-mail específico com botão "Veja o motivo".

## Implementação
- Status `error_reported` + `errorReport` no intake.
- API `POST /admin/operacional/campanhas/:id/reportar-erro`.
- API assinante `GET /disparos/campanhas/intake/:id/erro`.
- Créditos: intakes com erro não contam no consumo (`refreshConsumedFromIntakes`).
- Deep link `?campanhaErro=<id>`.
- Marker: `DEPLOY-2026-06-18-waba-campanha-erro-reportado`

## Validar
1. Operacional → campanha em andamento → Detalhes → Reportar Erro → justificativa.
2. Assinante vê "Erro Reportado" + "Motivo do Erro".
3. Saldo de envios volta ao disponível.
