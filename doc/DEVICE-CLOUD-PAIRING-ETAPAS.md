# Device Cloud — Pareamento WA Business (EM-6034) — Playbook permanente

Documento canônico para **não perder** o fluxo validado no V02.

**Ambiente:** `http://localhost:3012/version-02/`  
**UI:** Dispositivos → lingueta «Adicionar ao Aquecedor»  
**Device:** Redroid 720×1280, WhatsApp Business tema claro  
**Gate:** `DEVICE_CLOUD_PAIRING_NAV_MAX_STEP` em `index.html` (atual: **2**)

---

## Método obrigatório

1. Liberar **uma** etapa por vez (`DEVICE_CLOUD_PAIRING_NAV_MAX_STEP = N`).
2. Usuário testa e responde no chat.
3. Só então avançar `N+1`.
4. **Nunca** usar `ensureDeviceCloudWhatsAppForeground` (HOME + loop de launch) neste fluxo.
5. ADB/force-stop só no host **device-cloud** (não na VPS do Waba).

---

## Coords %

Automação usa `DEVICE_CLOUD_PAIRING_PCT`. No início do fluxo, `ensureDeviceCloudScreenMetrics` lê `naturalWidth×naturalHeight` do screenshot e converte %→px. Clique manual: `mapDeviceCloudPoint` com `getBoundingClientRect` (zoom-safe).

| Key | % (base 720×1280) |
|-----|-------------------|
| menu | 680/720, 104/1280 |
| dispositivosFallback | 491/720, 704/1280 |
| conectar | 360/720, 651/1280 |
| conectarNumero | 360/720, 1133/1280 |
| codeBoxYs / Xs | y=468/1280; xs calibrados |

Etapa 3 prefere `POST /device-cloud/device/:id/tap-overflow-item` (texto «Dispositivos conectados»).

---

## Etapas

| Step | O que faz |
|------|-----------|
| **1** | Abrir WhatsApp 1× |
| **2** | Menu ⋮ |
| **3** | Dispositivos conectados (texto) |
| **4** | CONECTAR DISPOSITIVO |
| **5** | Conectar com número |
| **6** | pairingCode + digitar (TYPE_CHARS) |
| **7+** | poll open |

Com `NAV_MAX_STEP < 6`, a lingueta **não** chama EVO — só navega.

Número EVO: `555182006034` via `formatDeviceCloudEvoNumber`.
