# Device Cloud — Pareamento (mapa proporcional)

**CHECKPOINT:** `doc/CHECKPOINT-2026-08-21__v02-device-cloud-pairing.md`  
**Tag:** `checkpoint/v02-device-cloud-pairing-2026-08-21`  
**Marker:** `DEPLOY-2026-08-21-dc-fix-false-browser-pairing-screen`

## Princípio

1. Ler o tamanho real do device via screenshot (`naturalWidth` × `naturalHeight`) — **não** o tamanho CSS/zoom do `<img>` no navegador.
2. Aplicar o mapa calibrado em **720×1280** com escala:  
   `x' = round(x_ref * W/720)`, `y' = round(y_ref * H/1280)`.
3. Sem ADB overflow / HOME / `ensureDeviceCloudWhatsAppForeground` (abre/fecha WA e clica chat).
4. Tela «Insira o código» **não** é Chrome (classificador + digitação sem abortar).

## Gate

`DEVICE_CLOUD_PAIRING_NAV_MAX_STEP = 7` (fluxo completo)

## Mapa REF 720×1280

| Etapa | Ação | px |
|------|------|-----|
| 1 | Abrir WA 1× | launch API |
| 2 | Menu ⋮ | (680, 104) |
| 3 | Dispositivos conectados | (491, 704) |
| 4 | CONECTAR DISPOSITIVO | (360, 651) |
| 5 | Conectar com número | (360, 1133) |
| 6 | Caixas do código | y=468; xs=71,147,223,299,418,494,572,648 |

## Ordem warm

1. Métricas do screenshot  
2. **Paralelo:** gerar pairingCode (número COM 9º BR) + abrir «Insira o código»  
3. Digitar 8 chars  
4. Se modal «Não foi possível conectar» → OK + 1 retry com número alternado  
5. Poll open / aquecedor  

## Device de referência

WABA · EM-6034 / phones.json `555182006034` → pairing EVO `5551982006034` (com 9º)
