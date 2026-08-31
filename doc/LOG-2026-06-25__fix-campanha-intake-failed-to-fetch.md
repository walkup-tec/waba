# LOG — Fix Gerar Campanha API Oficial (Failed to fetch)

## Contexto

Assinante na etapa 5 do wizard (Leads) com planilha e 200 envios solicitados recebia **"Failed to fetch"** ao clicar em **Gerar Campanha** (sem mensagem útil da API).

## Causas prováveis

1. Upload multipart sem handler de erro do **multer** (arquivo grande / limite) → conexão abortada sem JSON.
2. Exceções não tratadas ao ler/gravar planilha ou arquivos no disco → queda da requisição.
3. URL da API sem `WABA_BASE_PATH` em ambientes com subpasta (mitigado com `resolveWabaPublicPath`).

## Solução

### Backend (`waba-campaign-intake.routes.ts`)

- Middleware `handleCampaignIntakeUpload` com callback de erro multer → `400` JSON.
- `try/catch` global no POST intake → `500` JSON em falha inesperada.
- `try/catch` em leitura XLSX, trim e `writeFileSync`.
- `parseRequestedApiKind`: honra `apiKind: oficial` explícito quando há saldo no plano.

### Frontend (`index.html`)

- POST usa `resolveWabaPublicPath("/disparos/campanhas/intake")`.
- Mensagens amigáveis para `Failed to fetch` e `timeout`.

### Deploy marker

`DEPLOY-2026-06-25-campanha-intake-upload-fix`

## Arquivos

- `src/disparos/waba-campaign-intake.routes.ts`
- `index.html`, `dist/index.html`, `dist/index.js`
- `src/deploy-marker.ts`

## Validar

1. Reiniciar Node em produção/V02 após deploy (`node dist/index.js` ou redeploy Easypanel).
2. Wizard API Oficial → planilha + imagem 1080² → Gerar Campanha.
3. Deve retornar **201** ou erro JSON legível (não "Failed to fetch").
4. `GET /health` → `deployMarker` com `campanha-intake-upload-fix`.

## Palavras-chave

`campanhas/intake`, `Failed to fetch`, multer, `parseRequestedApiKind`, wizard API Oficial
