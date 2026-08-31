# Enviados — só após relatório do operacional

**Data:** 2026-06-12

## Regra
Card **Enviados** no Resumo lateral soma apenas `performanceReport.sent` de campanhas com status `completed` (operacional finalizou e gerou relatório).

Não usa mais `consumedShipments` do crédito (reserva na geração da campanha).

## Alterações
- `src/disparos/waba-campaign-intake.routes.ts` — `sentCount` em `toPublicIntake` via `resolveReportedSentCount`
- `index.html` — `computeDisparosEnviadosFinalizados` + `syncDisparosResumoSide`

## Sync ao finalizar
- Fingerprint inclui `sentCount`; detecta campanha recém-`completed`
- `refreshDisparosCampaignsAndResumo()` — campanhas antes dos créditos
- Card finalizado mostra linha **Envios realizados**

## Validar
Reiniciar `dev:v02` + Ctrl+F5. Ao operacional finalizar, resumo **Enviados** atualiza no próximo poll (5s) ou ao clicar Atualizar.
