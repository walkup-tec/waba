# LOG — produção sem Logs Sistema (precisa redeploy Easypanel)

## Sintoma
Login OK, mas menu/atualizações Logs Sistema não aparecem.

## Causa
Push `master` atualiza Git + workflow FTP; o app Node em produção é o serviço Easypanel `waba_disparador`, que só troca código no **Rebuild/Deploy**.

## Ação
1. Marker `DEPLOY-2026-07-11-logs-sistema`
2. Push commit de deploy
3. Easypanel → Redeploy `waba_disparador`
4. Após deploy: republicar `:30180` se health 502; validar `/health` → marker + menu Logs Sistema
