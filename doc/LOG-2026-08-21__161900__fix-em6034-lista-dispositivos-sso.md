# Fix: EM-6034 sumiu da lista Dispositivos (V02)

## Sintoma

Aba Dispositivos só mostrava «Adicionar dispositivo»; sem janela do EM-6034.

## Causa raiz (confiança: Alta)

`DEVICE_CLOUD_SSO_SECRET` no `.env.v02` estava com valor **errado** (37 chars extraído do transcript). A API `api-devices` responde `401 SSO token inválido`. Sem SSO, `restoreDeviceCloudBoard` não lista devices → tela vazia.

O device **existe** e está **ONLINE**: `WABA · EM-6034` (`11111111-1111-4111-8111-111111111111`).

## Correção

1. SSO secret correto (64 chars) no `.env.v02` (não commitado).
2. Restart V02.
3. `restoreDeviceCloudBoard`: se board vazio mas há devices ONLINE, desfaz `hidden` local e reabre.
4. Telefone `555182006034` em `data/v02/device-cloud-phones.json`.
5. Gates pairing (`MAX_STEP=2`, `%`) permanecem.

## Como validar

1. Ctrl+F5 em `http://localhost:3012/version-02/`
2. Abrir **Dispositivos**
3. Deve aparecer **WABA · EM-6034** com screenshot
4. Health: `DEPLOY-2026-08-21-dc-em6034-sso-fix`

## Keywords

EM-6034, DEVICE_CLOUD_SSO_SECRET, Dispositivos vazio, restoreDeviceCloudBoard
