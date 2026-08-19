# Device Cloud — lingueta usa número já cadastrado no WhatsApp

## Contexto

Ao clicar na lingueta **«Adicionar ao Aquecedor»**, o sistema pedia novamente o número (DDD + número) em vez de reutilizar o que foi integrado no WhatsApp do dispositivo via botão **Digitar**.

## Causa

1. `warmDeviceCloudInstance` lia apenas `phoneInput.value` no momento do clique.
2. Após **Digitar**, o número não era persistido por `deviceId`.
3. Patch anterior quebrou a declaração de `displayDeviceCloudName` (erro de sintaxe JS).
4. `dist/index.html` em produção ainda servia a versão antiga.

## Solução

- `getDeviceCloudRegisteredPhone(deviceId)` — memória (`deviceCloudWarmById.phoneDigits`) + `localStorage` (`layout.phones[deviceId]`).
- `setDeviceCloudRegisteredPhone(deviceId, digits)` — persiste após fluxo **Digitar** e ao iniciar integração com número válido.
- `restoreDeviceCloudPhoneField(deviceId)` — preenche o campo ao abrir/bind da janela.
- `warmDeviceCloudInstance` — usa número registrado; mensagem orienta **Digitar** sem focar no input.
- Corrigida função `displayDeviceCloudName`.
- Marker: `DEPLOY-2026-08-19-device-cloud-lingueta-usa-numero-device`.

## Arquivos

- `index.html`
- `src/deploy-marker.ts`
- `dist/index.html`, `dist/deploy-marker.js` (build)

## Validar

1. Device Cloud → DDD+número → **Digitar** → WhatsApp avança.
2. Clicar lingueta → integração inicia **sem** pedir número de novo.
3. Recarregar página → abrir mesmo device → lingueta ainda usa número salvo.
4. `/health` ou marker após redeploy Easypanel.

## Keywords

device-cloud, lingueta, phoneDigits, getDeviceCloudRegisteredPhone, Digitar, aquecedor
