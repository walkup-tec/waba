# LOG — deploy master billing Asaas

**Data:** 2026-06-09  
**Commit:** `d2f47ab` — `deploy: billing Asaas PIX Contratar + webhook /webhooks/asaas (prefixo waba:)`  
**Push:** `origin/master` OK (`91d4a8f` → `d2f47ab`)

## Conteúdo do deploy
- `src/billing/*` — cliente Asaas, pedidos, webhook
- `POST /webhooks/asaas` — identificação `waba:{uuid}`
- Contratar Disparos — modal PIX + polling
- `.env.example` — vars Asaas

## Pós-deploy (Easypanel `waba_disparador`)
1. Redeploy branch `master`
2. Env: `ASAAS_API_KEY`, `ASAAS_API_BASE_URL`, `ASAAS_WEBHOOK_ACCESS_TOKEN` (mesmas do Typebot)
3. Validar:
   ```powershell
   curl.exe -s -w "`nHTTP:%{http_code}" -X POST "https://waba.draxsistemas.com.br/webhooks/asaas" -H "Content-Type: application/json" -d "{}"
   ```
   Esperado: **401** (não 404)
4. Cadastrar webhook no Asaas com token alinhado ao env

## Pendências
- v02: demais alterações locais restauradas do stash (dev scripts, docs, favicon local, etc.)
