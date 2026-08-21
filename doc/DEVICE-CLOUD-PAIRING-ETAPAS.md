# Device Cloud — Pareamento WA Business (EM-6034) — Playbook permanente

Documento canônico para **não perder** o fluxo validado no V02.

**Ambiente:** `http://localhost:3012/version-02/`  
**UI:** Dispositivos → lingueta «Adicionar ao Aquecedor»  
**Device:** Redroid 720×1280, WhatsApp Business tema claro  
**Gate (quando ativo):** `DEVICE_CLOUD_PAIRING_NAV_MAX_STEP` em `index.html`

---

## Método obrigatório

1. Liberar **uma** etapa por vez (`DEVICE_CLOUD_PAIRING_NAV_MAX_STEP = N`).
2. Usuário testa e responde no chat.
3. Só então avançar `N+1`.
4. **Nunca** usar `ensureDeviceCloudWhatsAppForeground` (HOME + loop de launch) neste fluxo — abre e fecha o WA.
5. ADB/force-stop só no host **device-cloud** (não na VPS do Waba).

---

## Etapas (referência validada 2026-08-20)

| Step | O que faz | Coord / detalhe |
|------|-----------|-----------------|
| **1** | Abrir WhatsApp **1×** (`launchDeviceCloudWhatsApp`) | sem HOME |
| **2** | Menu ⋮ | `(680, 104)` ou % equivalente |
| **3** | Dispositivos conectados | preferir tap por **texto** do menu |
| **4** | CONECTAR DISPOSITIVO | botão inferior |
| **5** | Conectar com número | tela Insira o código |
| **6** | pairingCode + digitar | 1 char/caixa; TTL ~1 min |
| **7+** | poll open estável | sem soft-reset agressivo |

Número EVO: `555182006034` (sem 9º dígito) via `formatDeviceCloudEvoNumber`.

---

## Persistência V02

- Trabalho do V02 deve ficar na branch **`v02`** (commit + push).
- Antes de `git checkout` para outra branch: `scripts/check-v02-device-cloud.ps1`.
- Se `device-cloud-stage` sumir: merge `origin/master` → `v02` (Device Cloud veio da master).
