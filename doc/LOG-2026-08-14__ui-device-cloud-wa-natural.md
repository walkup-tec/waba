# LOG — Dispositivos: fluxo WhatsApp habitual

## Contexto
Informar o número e clicar Enviar não gerava SMS. O atalho despejava o texto via ADB e pedia para aguardar o código, sem passar por Avançar/confirmar do WhatsApp.

## Causa
`sendDeviceCloudNumber` só chamava `input/text` com todos os dígitos de uma vez. O WhatsApp só dispara SMS depois de Avançar + confirmar o número.

## Solução
- Abrir o WhatsApp Business ao criar o dispositivo
- Digitar um dígito de cada vez
- Botão Avançar (`KEYCODE_ENTER`)
- Teclado do PC na tela (0–9 / Enter)
- Textos do fluxo real: concordar → número → avançar → confirmar → SMS no celular real → código na tela

## Arquivos
- `index.html`
- `src/device-cloud/waba-device-cloud.service.ts`
- `src/device-cloud/waba-device-cloud.routes.ts`
- `src/deploy-marker.ts` → `DEPLOY-2026-08-14-device-cloud-wa-natural`

## Como validar
Dispositivos → Criar → EULA do WhatsApp → campo do número → Digitar → Avançar → confirmar na tela → SMS no celular real.

## Palavras-chave
device-cloud, whatsapp business, sms, avançar, cadastro, input text
