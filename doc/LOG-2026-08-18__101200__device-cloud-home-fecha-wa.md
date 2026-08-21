# LOG — Device Cloud: Abrir envia HOME e fecha o WhatsApp

## Contexto do pedido

O WhatsApp 2.26 abria na tela de nome comercial; ao clicar para preencher o nome, os cliques paravam de responder e o app “fechava”. Pedido também para verificar se havia atualização pendente de deploy.

## Ações executadas

- Conferência de Git vs produção (`/health`)
- Reprodução no Redroid (ADB): tap no campo, teclado, digitação, logcat, tombstone
- Teste isolado de `KEYCODE_HOME` (o que o WABA enviava após Abrir)

## Solução implementada

1. Confirmado: **não havia deploy pendente**. WABA produção = `DEPLOY-2026-08-18-device-cloud-rename-pencil` = `c2ace32`. Device Cloud = `DEPLOY-2026-08-18-device-cloud-launch-recover`.
2. Causa do fechamento: `launchDeviceCloudWhatsApp` chamava `dismissDeviceCloudWhatsAppCrash` **depois** do launch, e essa função enviava `key: home`. HOME tira o WhatsApp para o launcher (foco em `QuickstepLauncher`).
3. Removidas as chamadas de dismiss no fluxo Abrir; a função deixa de enviar HOME.

## Arquivos criados/alterados

- `.tmp-master-financeiro/index.html`
- `.tmp-master-financeiro/src/deploy-marker.ts`
- `.tmp-master-financeiro/dist/deploy-marker.js`

## Como validar

Após deploy WABA (`waba_disparador` Redeploy):

- `/health` com marker `DEPLOY-2026-08-18-device-cloud-no-home-after-launch`
- Abrir WhatsApp → tela de nome permanece
- Clicar no campo “Nome comercial” → teclado abre e o app **não** vai para o launcher

## Observações de segurança

Sem segredos. Sem envio WhatsApp de teste.

## Palavras-chave

device-cloud, RegisterName, KEYCODE_HOME, Abrir WhatsApp, dismissDeviceCloudWhatsAppCrash, 2.26.31.75, x86_64
