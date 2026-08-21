# Device Cloud — escala proporcional pelo tamanho real do device

## Contexto do pedido

O zoom do navegador reduziu o tamanho em px da imagem na tela. O fluxo «Adicionar ao Aquecedor» não deve depender disso. Deve ler o tamanho exposto do device (screenshot) e adaptar o mapa calibrado 720×1280 de forma proporcional — sem retestar etapa por etapa.

## Ações executadas

- Removido uso de ADB `tap-overflow-item` no fluxo de warm (reabria WA / BACK / toques fora do mapa).
- Introduzido `DEVICE_CLOUD_PAIRING_MAP` em px REF + `sendDeviceCloudTapMapped` com escala `W/720` e `H/1280`.
- `ensureDeviceCloudScreenMetrics({ force: true })` no início de `warmDeviceCloudInstance` e de `openDeviceCloudWhatsAppPairingCodeScreen`.
- Fonte das métricas: `img.naturalWidth` / `naturalHeight` do screenshot (não CSS/zoom).
- Marker: `DEPLOY-2026-08-21-dc-pairing-scale-from-device-metrics`.
- Doc: `doc/DEVICE-CLOUD-PAIRING-ETAPAS.md`.

## Solução

1. Antes de continuar o aquecedor: força refresh do screenshot e lê `naturalWidth×Height`.
2. Cada toque: `x' = round(x_ref * W/720)`, `y' = round(y_ref * H/1280)`.
3. Sequência fixa do mapa validado: menu (680,104) → Dispositivos (491,704) → CONECTAR (360,651) → número (360,1133) → caixas do código.

## Arquivos

- `index.html`
- `src/deploy-marker.ts`
- `doc/DEVICE-CLOUD-PAIRING-ETAPAS.md`
- `doc/LOG-2026-08-21__170006__device-cloud-pairing-scale-metrics.md`
- `.cursor/project-memory/05-DECISIONS.md`, `06-CURRENT_STATUS.md`
- `doc/memoria.md`

## Como validar

1. Hard refresh em `http://localhost:3012/version-02/` (zoom do browser pode ficar em 80% — não deve importar).
2. Lingueta «Adicionar ao Aquecedor» — status deve mostrar `Tamanho do device: W×H (mapa 720×1280)`.
3. Observar navegação no WA Business sem abrir/fechar app nem cair em Comunidades/chat.

## Segurança

Sem segredos novos. `.env.v02` SSO/ADB permanecem locais.

## Palavras-chave

device-cloud, pairing, scale, naturalWidth, zoom, 720x1280, Adicionar ao Aquecedor, EM-6034
