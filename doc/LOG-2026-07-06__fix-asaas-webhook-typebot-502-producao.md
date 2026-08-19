# LOG — 2026-07-06 — Webhook Asaas Typebot 502 (produção)

## Alerta Asaas (e-mail 2026-07-03)
- **Webhook:** `typebot`
- **URL:** `https://app.chattypebot.com/api/webhooks/asaas`
- **Erro:** HTTP **502 Bad Gateway**
- **Conta:** `asaas@walkuptec.com.br`

## Causa
O Asaas exige **HTTP 200** no webhook. **502** = Traefik/proxy não alcança o serviço **typebot API** (não é bug do handler — código já responde 200 async).

Histórico: mesmo padrão de LP/painel/WABA — `main.yaml` do Easypanel aponta upstream morto após redeploy.

## Correção (VPS root)

```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/typeBot/master/scripts/fix-typebot-asaas-webhook-vps.sh" -o /tmp/fix-typebot-asaas-webhook.sh
sed -i 's/\r$//' /tmp/fix-typebot-asaas-webhook.sh
chmod +x /tmp/fix-typebot-asaas-webhook.sh
/tmp/fix-typebot-asaas-webhook.sh
```

Esperado: `health=200` e `webhook_post=200` ou `401` (nunca 502).

Se ainda 502:
```bash
/root/traefik-permanent-vps.sh install   # se ainda não instalado
/root/traefik-permanent-vps.sh run
```

## Após endpoint OK

1. **Easypanel** → projeto **typebot** → serviço **api**:
   - `ASAAS_WEBHOOK_ACCESS_TOKEN` = token do webhook **typebot** no Asaas
   - Redeploy do serviço `api`
2. **Painel Asaas** → Integrações → Webhooks → **typebot** → **Reativar fila**
3. Validar com token:
```bash
curl -sS -w "\nHTTP:%{http_code}\n" -X POST "https://app.chattypebot.com/api/webhooks/asaas" \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: SEU_TOKEN" \
  -d '{"event":"PAYMENT_RECEIVED","payment":{"id":"pay_test"}}'
# Esperado: HTTP 200 {"ok":true,"accepted":true}
```

## Repo
- Script: `typebot-Saas/scripts/fix-typebot-asaas-webhook-vps.sh`
- Traefik: `typebot-Saas/scripts/traefik-permanent-vps.sh` (agora reinicia se `app` = 502)

## Webhook WABA (separado)
`https://waba.draxsistemas.com.br/webhooks/asaas` — não confundir com typebot.
