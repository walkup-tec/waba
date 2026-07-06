# LOG — QR Code Evolution: GET /instance/connect only

## Contexto

Após deploy Easypanel (commit `badfbea` / marker `DEPLOY-2026-06-30-qrcode-evo-connect-only-fix`), o registro de QR falhou:

```json
{"status":404,"error":"Not Found","response":{"message":["Cannot POST /instance/connect/atendimento-6019"]}}
```

Evolution API **v2** expõe QR apenas via **GET** `/instance/connect/{instance}` (opcional `?number=`). POST nessa rota retorna 404.

## Solução

1. `buildEvoConnectQrCandidates` — candidatos **somente GET** (com e sem `?number=`).
2. `isIgnorableEvoQrFetchError` — ignora 404 de POST legado em connect (não polui mensagem final).
3. `deploy-marker.ts` → `DEPLOY-2026-06-30-qrcode-evo-connect-get-only`.

## Arquivos alterados

- `src/index.ts`
- `src/deploy-marker.ts`
- `dist/index.js`
- `dist/deploy-marker.js`

## Como validar

1. Redeploy no Easypanel no commit com este fix.
2. `GET /health` → `deployMarker` = `DEPLOY-2026-06-30-qrcode-evo-connect-get-only`.
3. Instâncias → Registrar QR → instância `atendimento-6019` / número `555182006019`.
4. Se ainda 404 em GET connect: conferir `EVO_API_URL`, instância criada na Evolution e `CONFIG_SESSION_PHONE_VERSION`.

## Palavras-chave

`qrcode`, `evo-connect-get`, `atendimento-6019`, `Cannot POST /instance/connect`, `Evolution v2`
