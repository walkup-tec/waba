# LOG — Fix QRCode após purge Mozart (extract + tombstone)

## Contexto
Após zerar instâncias do `mozart.pmo@gmail.com`, o painel mostrou **«Erro ao gerar QRCode da instância.»** no Passo 2. Teste direto na EVO (`POST /instance/create`) retornava **201** com QR base64 — falha no caminho WABA→EVO / extração / tombstone local.

## Causa
1. `tryExtractQrCode` podia preferir o campo Baileys `code` (`2@…`) em vez do `base64` da imagem.
2. Tombstone em `deletedInstances` podia bloquear re-registro do mesmo nome.
3. UI genérica escondia o detalhe real do erro.

## Solução
1. Extrator: ignora `code`/`pairingCode`; rejeita strings com `@`/`,`; prioriza `base64` antes de `code`.
2. `claimOnRegister` limpa marca de deletado antes de vincular.
3. UI: mensagem de fallback aponta `EVO_API_URL` e exibe detalhe quando útil.
4. Marker: `DEPLOY-2026-07-25-qrcode-extract-tombstone`

## Arquivos
- `src/index.ts`, `dist/index.js` — `tryExtractQrCode`
- `src/instances/waba-instance-ownership.service.ts` — `clearDeletedMark` em `claimOnRegister`
- `src/deploy-marker.ts`, `dist/deploy-marker.js`
- `index.html`, `dist/index.html` — `resolveRegistrarQrcodeErrorMessage`

## Validar
1. Push `master` + **Redeploy Node** `waba_disparador`.
2. `GET /health` → `deployMarker` = `DEPLOY-2026-07-25-qrcode-extract-tombstone`.
3. Se 502/404 no login: heal `:30180` (watch/timer).
4. Registrar instância com **nome novo** → QR deve aparecer.
5. Se falhar: conferir `EVO_API_URL` no Easypanel (`http://172.17.0.1:30181` ou host público EVO).

## Segurança
Sem segredos no LOG. Não apagar `walkup` / `soma-crm` sem `FORCE_PROTECT=1`.

## Palavras-chave
qrcode, tryExtractQrCode, base64, code 2@, tombstone, deletedInstances, claimOnRegister, mozart purge, EVO_API_URL
