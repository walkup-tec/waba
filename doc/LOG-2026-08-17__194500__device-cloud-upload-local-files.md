# LOG — Device Cloud: upload de imagens locais (PC → celular)

## Contexto

Pedido: permitir upload de **foto de perfil** e **capa** do WhatsApp a partir de arquivos locais no PC, enviando para a pasta Download do Android virtual.

## Causa raiz do bloqueio

1. **WABA** já tinha UI e rota proxy, mas faltava skip do body parser para multipart em `/device-cloud/device/:id/push-media`.
2. **Device Cloud API** em produção (`DEPLOY-2026-08-14-browser-input-mvp`) **não expunha** `POST /devices/:id/push-file`.

## Solução implementada

### WABA (worktree `.tmp-master-financeiro`)

- UI: inputs `Foto perfil` e `Capa` com `<input type="file">` no painel Device Cloud.
- Frontend: `FormData` → `POST /device-cloud/device/:id/push-media` (multer, até 5 MB, JPG/PNG/WebP).
- Backend: proxy para Device Cloud `POST /devices/:id/push-file` com base64.
- `shouldSkipBodyParserForMultipart`: inclui rota push-media.
- Marker: `DEPLOY-2026-08-17-device-cloud-upload-local`.

### Device Cloud (`walkup-tec/drax-device-cloud`)

- `adb push` + media scan em `/sdcard/Download/`.
- Endpoint `POST :id/push-file` com `{ remotePath, contentBase64 }`.
- Preserva input/tap/swipe/text/key existentes.
- Health marker: `DEPLOY-2026-08-17-device-cloud-push-file-input`.
- Commits: `cb12758`, workflow CI `bfdebb8`.

## Deploy

| Componente | Status |
|------------|--------|
| GitHub `drax-device-cloud` main | Push OK |
| Device Cloud produção | **Pendente redeploy Easypanel** (marker ainda antigo) |
| WABA produção | **Pendente commit/push master + redeploy** |

Redeploy Device Cloud: Easypanel → serviço `device-cloud-api` → Redeploy (branch `main`).

## Como validar

1. Login mozart → Dispositivos → abrir celular virtual.
2. Escolher JPG/PNG no PC (Foto perfil ou Capa).
3. Toast: "Imagem enviada para Download do celular…"
4. No WhatsApp: Perfil → editar → Galeria → arquivo `waba-perfil-*.jpg` ou `waba-capa-*.jpg`.

## Segurança

- Allowlist email Device Cloud inalterada.
- Arquivos só em `/sdcard/Download/` com prefixo controlado.
- Sem segredos em commits.

## Palavras-chave

device-cloud, push-file, push-media, multer, upload local, foto perfil, capa
