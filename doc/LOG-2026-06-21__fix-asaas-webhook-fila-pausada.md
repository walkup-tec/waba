# LOG — Fix fila pausada / penalizada webhooks Asaas

## Contexto
2 webhooks parados + 1 penalizado no painel Asaas (Integrações → Webhooks).
Doc: https://docs.asaas.com/docs/fila-pausada

## Causa
- Asaas **só aceita HTTP 200** como sucesso (401/400/500 = falha → retentativas → fila pausada após 15 falhas).
- Produção retornava **401** sem header `asaas-access-token` (token no Easypanel ≠ token no painel Asaas).
- Handler de pagamento podia retornar **400** em exceção.
- Transfer-authorization retornava **400** no catch.
- Manutenção bloqueava `/webhooks/asaas/transfer-authorization` (503).

## Correção código (marker `DEPLOY-2026-06-21-asaas-webhook-200-async`)
- `POST /webhooks/asaas`: responde **200 imediato** + processa async (`setImmediate`).
- Erros de processamento só logam (não quebram fila).
- Transfer-auth: catch retorna **200** + `REFUSED`.
- Token: aceita lista `ASAAS_WEBHOOK_ACCESS_TOKEN=token1,token2` e headers alternativos.
- Manutenção: bypass para `/webhooks/asaas/*`.

## Ação Easypanel (obrigatório)
1. `waba_disparador` env:
   - `ASAAS_WEBHOOK_ACCESS_TOKEN` = **mesmo token** cadastrado no webhook **waba** no Asaas
   - `ASAAS_TRANSFER_WEBHOOK_ACCESS_TOKEN` = token do webhook **transfer-authorization** (ou igual ao acima)
2. URLs no Asaas:
   - Pagamentos: `https://waba.draxsistemas.com.br/webhooks/asaas`
   - Autorização transferência: `https://waba.draxsistemas.com.br/webhooks/asaas/transfer-authorization`
3. Redeploy após alterar env.

## Reativar filas no Asaas
Integrações → Webhooks → webhook com fila interrompida → **Reativar fila** (após deploy + token OK).

## Validar
```bash
curl -X POST "https://waba.draxsistemas.com.br/webhooks/asaas" \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: SEU_TOKEN" \
  -d '{"event":"PAYMENT_RECEIVED","payment":{"id":"pay_test","externalReference":"waba:00000000-0000-0000-0000-000000000000"}}'
# Esperado: HTTP 200 {"ok":true,"accepted":true}
```

## Typebot (webhook separado)
Serviço `app.chattypebot.com` — alinhar `ASAAS_WEBHOOK_ACCESS_TOKEN` do Typebot com token do webhook **typebot** no Asaas.

## Palavras-chave
asaas, webhook, fila pausada, 401, asaas-access-token, transfer-authorization
