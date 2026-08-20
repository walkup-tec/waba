# Device Cloud — pairingCode automático, sem QR imagem

## Contexto

Ao clicar em **Adicionar ao Aquecedor**, a UI exibia QR Code (imagem base64) abaixo do device e pedia digitação manual. O fluxo desejado usa só o `pairingCode` do EVO, inserido automaticamente no WhatsApp do dispositivo.

## Solução

1. Remover QR / código / hint manual do painel `device-cloud-warm-panel`.
2. Fluxo ao clicar na lingueta:
   - Localiza número do device
   - Abre tela de vinculação no WhatsApp (menu → Aparelhos conectados → Vincular com número)
   - Chama EVO (`registrar-qrcode`) e exige `pairingCode`
   - Digita o código no device via `input/text`
   - Poll `status-conexao` até `open` (sem CONFIRMAR)
3. Sem fallback para imagem QR.

## Arquivos

- `index.html`
- `src/deploy-marker.ts` → `DEPLOY-2026-08-20-device-cloud-pairing-auto-insert`

## Validar

1. Redeploy `waba_disparador` + Ctrl+F5
2. Dispositivos → lingueta **Adicionar ao Aquecedor**
3. Não deve aparecer QR abaixo do device
4. Status: abrindo tela → gerando código → inserindo → finalizando
5. Instância aparece em **Instâncias** com aquecedor ativo

## Observação

Coordenadas de toque (720×1280) são best-effort; se a navegação do menu falhar, ajustar taps após screenshot.

## Keywords

device-cloud, pairingCode, auto-insert, sem-qr, aquecedor, aparelhos-conectados
