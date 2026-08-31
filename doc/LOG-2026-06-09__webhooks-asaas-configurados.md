# LOG — webhooks Asaas configurados (Typebot + WABA)

**Data:** 2026-06-09

## Painel Asaas
| Nome | URL | Token (env) |
|------|-----|-------------|
| typebot | `https://app.chattypebot.com/api/webhooks/asaas` | `ASAAS_WEBHOOK_ACCESS_TOKEN` serviço API Typebot |
| waba | `https://waba.draxsistemas.com.br/webhooks/asaas` | `ASAAS_WEBHOOK_ACCESS_TOKEN` serviço waba_disparador |

Tipo envio: **Sequencial** (ambos). API v3.

## Validação pós-config (2026-06-09)
- **WABA** `POST /webhooks/asaas` → **200** (deploy `d2f47ab` ativo). Sem token no env ainda aceita qualquer POST.
- **Typebot** `POST /api/webhooks/asaas` com token do painel → **401** — `ASAAS_WEBHOOK_ACCESS_TOKEN` no Easypanel API **não coincide** com token cadastrado no Asaas.

## Ação pendente
1. Easypanel API Typebot: `ASAAS_WEBHOOK_ACCESS_TOKEN` = token webhook **typebot** → redeploy
2. Easypanel waba_disparador: `ASAAS_WEBHOOK_ACCESS_TOKEN` = token webhook **waba** + `ASAAS_API_KEY` + `ASAAS_API_BASE_URL` → redeploy
3. Retestar ambos com header `asaas-access-token` → esperado **200**

## Segurança
Tokens gerados no Asaas; não commitar no git.
