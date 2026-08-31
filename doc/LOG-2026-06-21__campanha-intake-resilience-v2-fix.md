# LOG — Campanha intake resilience v2 (API Oficial produção)

**Data:** 2026-06-21  
**Contexto:** Usuário `mozart.pmo@gmail.com` falhou ao gerar campanha API Oficial em produção (898 linhas, 200 envios). Erro: *"Falha de conexão com o servidor ao enviar a campanha"*.

## Causa raiz

1. **Backend Node desatualizado em produção** — `GET /health` retornava marker antigo sem `campaignIntakeSafeParser`.
2. **`express.json` / `express.urlencoded` consumiam o body** do `POST /disparos/campanhas/intake` (multipart) antes do `multer`, gerando falha intermitente / 502 / `Failed to fetch`.

## Solução implementada

### Backend
- `src/disparos/waba-campaign-intake.constants.ts` — versão API (`WABA_CAMPAIGN_INTAKE_API_VERSION = 2`) e flag `campaignIntakeSafeParser`.
- `src/index.ts` — `shouldSkipDefaultBodyParsers()` pula json e urlencoded em:
  - `POST /disparos/campanhas/intake` (sempre)
  - `POST /disparos/campanhas` quando `multipart/form-data`
- `GET /health` expõe `campaignIntakeApiVersion` e `campaignIntakeSafeParser`.
- `src/disparos/waba-campaign-intake.routes.ts` — handler multer com erros 400 legíveis (tamanho de arquivo).
- `src/deploy-marker.ts` → `DEPLOY-2026-06-21-campanha-intake-resilience-v2`.

### Frontend (`index.html`)
- Campos do wizard com `required` / `minlength` (nome, DDD, imagem, textos, link, planilha, envios).
- Validação async no submit com revalidação de imagem 1080×1080.
- Preflight `assertCampaignIntakeBackendReady()` via `/health` antes do POST.
- Retry (3×) com **rebuild de FormData** a cada tentativa; timeout dinâmico por tamanho dos arquivos.
- `resolveWabaPublicPath` no intake; mensagens de erro distingue backend desatualizado vs rede.
- `stopDisparosCampaignsPolling()` durante submit.
- API Alternativa (`createCampaignFromMappedSpreadsheet`): retry, `credentials`, `resolveWabaPublicPath`, erros mais claros.

## Arquivos alterados

- `src/disparos/waba-campaign-intake.constants.ts` (novo)
- `src/index.ts`
- `src/deploy-marker.ts`
- `src/disparos/waba-campaign-intake.routes.ts`
- `index.html`

## Como validar

1. **Redeploy obrigatório** do serviço Node `waba_disparador` no Easypanel (FTP só atualiza estáticos).
2. `curl https://waba.draxsistemas.com.br/health` deve retornar:
   - `deployMarker`: `DEPLOY-2026-06-21-campanha-intake-resilience-v2`
   - `campaignIntakeSafeParser`: `true`
   - `campaignIntakeApiVersion`: `2`
3. Login como assinante → Nova campanha → preencher todos os passos → Gerar Campanha (planilha grande + 200 envios).
4. Se backend antigo: mensagem explícita pedindo redeploy (não mais "falha genérica" sem contexto).

## Segurança

- Sem exposição de segredos.
- Validação server-side mantida (nome, DDD, textos, link, imagem, planilha, apiKind, plannedSendCount).

## Palavras-chave

`campanha-intake`, `multipart`, `multer`, `express.json`, `campaignIntakeSafeParser`, `mozart`, `API Oficial`, `wizard`, `retry`, `health preflight`
