# LOG — Env Asaas completo para Easypanel

**Data:** 2026-06-21  
**Pedido:** Atualizar env local com bloco Asaas completo (credenciais já informadas) para colar no Easypanel.

## Contexto

O `.env` principal estava incompleto vs `.env.v02`: faltavam `ASAAS_TRANSFER_API_KEY`, `ASAAS_TRANSFER_WEBHOOK_ACCESS_TOKEN` e comentários de URLs dos webhooks.

## Ações

1. Atualizado bloco Asaas em `E:\Waba\.env` e `E:\Waba\.env.v02` com todas as variáveis de produção.
2. Criado `env.easypanel-producao-asaas.snippet` — bloco limpo só com vars Asaas para copiar/colar no Easypanel (`waba_disparador`).
3. Adicionado `env.easypanel-producao-asaas.snippet` ao `.gitignore` (contém segredos).

## Variáveis incluídas

| Variável | Função |
|----------|--------|
| `ASAAS_API_BASE_URL` | API produção v3 |
| `ASAAS_API_KEY` | Cobrança PIX (checkout créditos) |
| `ASAAS_TRANSFER_API_KEY` | Repasse/split PIX |
| `ASAAS_WEBHOOK_ACCESS_TOKEN` | Header `asaas-access-token` webhook pagamentos |
| `ASAAS_TRANSFER_WEBHOOK_ACCESS_TOKEN` | Mesmo token (webhook transfer-authorization) |
| `WABA_DISPAROS_MIN_CREDIT_CENTS` | Mínimo R$ 300,00 |
| `WABA_FINANCEIRO_SPLIT_PAYOUT_ENABLED` | Repasse automático split |

## Webhooks no painel Asaas

- Pagamentos: `https://waba.draxsistemas.com.br/webhooks/asaas`
- Transferência: `https://waba.draxsistemas.com.br/webhooks/asaas/transfer-authorization`

## Como validar

1. Colar vars do snippet no Easypanel → Environment → Save → Redeploy.
2. No Asaas, reativar filas pausadas se necessário (docs fila pausada).
3. Testar checkout créditos (PIX) e confirmar webhook retorna HTTP 200.

## Segurança

Segredos permanecem apenas em arquivos gitignored; não commitados.

## Palavras-chave

`asaas`, `easypanel`, `env`, `webhook`, `transfer-api-key`, `split-payout`
