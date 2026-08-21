# CHECKPOINT — Device Cloud pareamento (V02) — 2026-08-21

**Objetivo deste arquivo:** ponto de restauração se o trabalho da `v02` for perdido (checkout errado, merge, working tree limpa).

| Campo | Valor |
|-------|--------|
| Branch | `v02` |
| Tag sugerida | `checkpoint/v02-device-cloud-pairing-2026-08-21` |
| Branch backup | `backup/v02-device-cloud-pairing-checkpoint-20260821` |
| Marker | `DEPLOY-2026-08-21-dc-fix-false-browser-pairing-screen` |
| Device | WABA · EM-6034 (`11111111-1111-4111-8111-111111111111`) |
| Número EVO | `555182006034` (sem 9º forçado) |
| UI | `http://localhost:3012/version-02/` → Dispositivos → «Adicionar ao Aquecedor» |

---

## Estado alcançado (funcional)

1. Lista Dispositivos mostra EM-6034 (SSO Device Cloud OK no `.env.v02` local — **não versionar segredo**).
2. Navegação WA Business até **«Insira o código»** com mapa calibrado 720×1280.
3. Toque em **Dispositivos conectados** = (491, 704) — **não** Comunidades (Y≈560).
4. Zoom do browser **não** afeta toques: métricas = `naturalWidth×Height` do screenshot.
5. Soft-reset EVO (logout/delete) com teto 35s; gerar pairingCode **antes** de abrir a tela de código.
6. Classificador **não** trata «Insira o código» como Chrome; digitação não aborta por falso «navegador».

Pendente de validação humana completa: integração `open` no aquecedor após digitar os 8 chars (última milha operacional).

---

## Regras permanentes deste fluxo

### Mapa REF 720×1280

| Etapa | Ação | px |
|------|------|-----|
| 1 | Abrir WA 1× | `launch-whatsapp-business` (sem HOME loop) |
| 2 | Menu ⋮ | (680, 104) |
| 3 | Dispositivos conectados | (491, 704) |
| 4 | CONECTAR DISPOSITIVO | (360, 651) |
| 5 | Conectar com número | (360, 1133) |
| 6 | Caixas código | y=468; xs=71,147,223,299,418,494,572,648 |

Escala: `x' = round(x_ref * W/720)`, `y' = round(y_ref * H/1280)`.

### Ordem warm (obrigatória)

1. Ler métricas do screenshot (`ensureDeviceCloudScreenMetrics` force).
2. **Gerar** pairingCode (`submitAndPollRegistrarQrcode`) com progresso na lingueta.
3. Abrir «Insira o código» (`openDeviceCloudWhatsAppPairingCodeScreen`).
4. Digitar 8 chars (`typeDeviceCloudPairingCodeOnDevice`) — **sem** abortar por classify=browser.
5. Poll conexão / finalizar aquecedor.

### Proibido no warm

- ADB overflow / `tap-overflow-item` como caminho principal.
- `ensureDeviceCloudWhatsAppForeground` / HOME loop (abre/fecha WA, clica chat).
- Usar `clientWidth` / zoom CSS para toques automatizados.
- Tratar teclado claro + barra branca como Chrome (tela de código WA).

### Classificador

- Caixas pretas do código (faixa y≈33–42%) → `whatsapp`.
- Verde WA no topo → `whatsapp`.
- `browser` só com barra Chrome + teclado claro **e** sem tinta das caixas.

---

## Arquivos canônicos

| Arquivo | Papel |
|---------|--------|
| `index.html` | UI Device Cloud, mapa, warm, classify, digitação |
| `src/deploy-marker.ts` | Marker de cache/boot |
| `src/index.ts` | Soft-reset EVO com budget 35s; registrar-qrcode |
| `src/device-cloud/*` | Backend Device Cloud / ADB (secundário) |
| `doc/DEVICE-CLOUD-PAIRING-ETAPAS.md` | Playbook curto |
| `doc/DEVICE-CLOUD.md` | Memória permanente do celular virtual |
| `.cursor/rules/v02-trabalho-permanente.mdc` | Nunca checkout sem preservar Device Cloud |
| `scripts/check-v02-device-cloud.ps1` | Guarda ao subir V02 |

### LOGs desta jornada

- `doc/LOG-2026-08-21__161900__fix-em6034-lista-dispositivos-sso.md`
- `doc/LOG-2026-08-21__170006__device-cloud-pairing-scale-metrics.md`
- `doc/LOG-2026-08-21__174600__fix-false-browser-pairing-screen.md`
- Este arquivo: `doc/CHECKPOINT-2026-08-21__v02-device-cloud-pairing.md`

---

## Como restaurar se perder

```powershell
cd D:\01A-Drax-Servidor\Waba   # preferir E:\01A-Drax-Servidor\Waba se for o path oficial
git fetch origin
git checkout v02
git reset --hard checkpoint/v02-device-cloud-pairing-2026-08-21
# OU:
git checkout backup/v02-device-cloud-pairing-checkpoint-20260821
powershell -File scripts/check-v02-device-cloud.ps1
powershell -File scripts/dev-v02.ps1
```

Conferir marker em `/version-02/health` = `DEPLOY-2026-08-21-dc-fix-false-browser-pairing-screen`.

SSO Device Cloud no `.env.v02` deve ser o secret **64 chars** (local; não está no Git).

---

## Palavras-chave

checkpoint, v02, device-cloud, pairing, EM-6034, Insira o código, naturalWidth, soft-reset, falso navegador, Adicionar ao Aquecedor
