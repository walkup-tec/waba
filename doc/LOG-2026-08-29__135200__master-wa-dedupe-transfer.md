# LOG — Masters recebiam várias WhatsApp iguais ao transferir campanha

## Contexto do pedido

Ao transferir uma campanha de um operacional para outro, os usuários master receberam várias notificações WhatsApp com a mesma informação.

## Causa raiz

`forceAssignToOperacionalEmail` chama `scheduleOperacionalStaffNotifyOnCampaignAssigned`, que dispara o mesmo texto de «nova campanha» para **cada** cadastro master. A lista só deduplica e-mail. Vários masters com o mesmo WhatsApp (ou o operacional no mesmo número) geram N envios. A chave de retry também incluía o e-mail, então o retried não unificava o telefone.

## Solução

1. Um envio por número (últimos 11 dígitos). Número já notificado nesta campanha é ignorado.
2. Transferência / reatribuição (`manual_master`, `timeout_30h`, `bm_inoperante`) usa texto de transferência, não «nova campanha foi gerada».
3. Retry WhatsApp passa a ser por campanha + evento + telefone.

## Arquivos alterados

- `src/mail/waba-operacional-campaign-notify.service.ts`
- `src/mail/waba-operacional-campaign-whatsapp.service.ts`
- `src/mail/waba-mail.templates.ts`
- `src/deploy-marker.ts`

## Como validar

1. Transferir campanha com dois cadastros master no mesmo WhatsApp → **uma** mensagem nesse número.
2. Texto deve falar em transferência, não em campanha nova.
3. Após Redeploy: `GET /health` = `DEPLOY-2026-08-29-135200-master-wa-dedupe-transfer`

## Palavras-chave

transferencia campanha, notify master, whatsapp duplicado, listMasterUsers, manual_master
