# Fix v2 — campanha duplicada (obotmoney / op_jose)

**Data:** 2026-07-09  
**Caso:** `obotmoney@gmail.com` ainda gerava campanha em duplicidade; operador `op_jose` recebia duas campanhas.

## Causas (além do fix v1)

1. **Duplo clique / corrida no frontend:** `disCampaignWizardSubmitInFlight` só era ativado **depois** de `await validateDisCampaignWizardForSubmit()` — dois cliques rápidos geravam **dois `clientRequestId` diferentes** e duas campanhas.
2. **Corrida no backend:** duas requisições com o **mesmo** `clientRequestId` passavam o `findByOwnerAndClientRequestId` antes de qualquer uma gravar (check-then-act).
3. **Retry após erro com novo ID:** `clientRequestId` era limpo no `finally` mesmo em falha — novo clique gerava nova chave sem dedupe.

## Correção v2 (`campaignIntakeApiVersion` 4)

### Backend
- `withCampaignIntakeSubmissionLock` — serializa POSTs com mesma chave (`email:clientRequestId` ou fingerprint).
- Dedupe dentro do lock: `clientRequestId` + `submissionFingerprint` (nome, DDD, envios, API, tamanhos de arquivo) em janela de 5 min.
- Campo `submissionFingerprint` no intake.
- Resposta deduplicada **não** cria campanha nem consome crédito nem re-notifica.

### Frontend
- Lock síncrono + botão desabilitado **antes** de qualquer `await`.
- Reutiliza `clientRequestId` em retries/erros até sucesso (só limpa após envio OK).
- `WABA_CAMPAIGN_INTAKE_API_VERSION_EXPECTED = 4`.

## Marker

`DEPLOY-2026-07-09-fix-campanha-duplicada-idempotencia-v2`

## Validar

1. Redeploy `waba_disparador` — `/health` com `campaignIntakeApiVersion: 4` e marker acima.
2. Duplo clique em Gerar Campanha → uma campanha, um aviso ao operacional.
3. Simular timeout e reenviar → `deduplicated: true`, sem segunda campanha.

## Palavras-chave

`campanha duplicada`, `clientRequestId`, `submissionFingerprint`, `withCampaignIntakeSubmissionLock`, `obotmoney`, `op_jose`
