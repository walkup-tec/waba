# LOG — Contratar Disparos via PIX Asaas

**Data:** 2026-06-09  
**Pedido:** botão Contratar com PIX Asaas; identificar cobrança WABA na conta compartilhada.

## Identificação Asaas (conta compartilhada)

| Campo | Valor |
|-------|--------|
| `externalReference` | `waba:{orderUuid}` (cliente + pagamento) |
| `description` | `WABA Disparos · API Oficial · créditos` ou `· API Alternativa ·` |
| `product` local | `waba-disparos` em `data/waba-billing-orders.json` |
| Webhook | ignora eventos cujo `externalReference` não começa com `waba:` |

## Arquivos novos

- `src/billing/asaas.client.ts`
- `src/billing/asaas-identifiers.ts`
- `src/billing/phone.ts`
- `src/billing/waba-billing-order.repository.ts`
- `src/billing/waba-billing.service.ts`
- `src/billing/waba-billing.routes.ts`

## Rotas

- `GET /billing/disparos/config`
- `GET /billing/disparos/status`
- `POST /billing/disparos/checkout`
- `GET /billing/disparos/orders/:orderId`
- `POST /webhooks/asaas`

## Frontend

- Modais `#disparos-billing-overlay` e `#disparos-pix-overlay`
- Contratar abre formulário → gera PIX → polling a cada 5s

## Env (`.env.example`)

- `ASAAS_API_KEY`, `ASAAS_API_BASE_URL`, `ASAAS_WEBHOOK_ACCESS_TOKEN`
- `WABA_DISPAROS_MIN_CREDIT_CENTS=30000`

## Pendências

- Configurar webhook no painel Asaas apontando para produção WABA
- Se mesma conta Asaas do Typebot: cada sistema filtra pelo prefixo (`waba:` vs UUID Typebot)
- Commit/deploy quando usuário solicitar
- Créditos pós-pagamento: hoje marca `paid`; liberar features Disparos conforme regra de negócio
