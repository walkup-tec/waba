# Integrações

## Visão geral

WhatsApp (API oficial e alternativa via Evolution), Supabase, e-mail transacional (boas-vindas e alertas).

## APIs

| Serviço | Finalidade | Autenticação |
|---------|------------|--------------|
| WhatsApp API oficial | Mensageria | Meta / tokens do app |
| Evolution (API alternativa / outbound) | Boas-vindas, alertas, aquecedor, disparos | `EVO_API_URL` + `EVO_API_KEY` |
| Supabase | Dados / backend-as-a-service | keys no `.env` |

## Webhooks

_A preencher com endpoints e eventos confirmados._

## Serviços externos

- Evolution: sequência padrão de envio WhatsApp do WABA (números/hints configuráveis; primária histórica `51981077770` com fallbacks).
- SMTP / mail: e-mail de boas-vindas e notificações.

## Autenticação

Sessão WABA (cookie) para master/staff/assinante; rotas admin restritas a master.

## Fluxos de comunicação

### Boas-vindas assinante

- Cadastro ou `POST /admin/subscribers/:id/resend-welcome` → e-mail + WhatsApp.
- Reenvio **sem** body de senha.

### Aquecedor — confirmação de entrega

- Após `sendText`: tag única + `findMessages`/`findChats` no destino; fallback `DELIVERY_ACK`/`READ`/`PLAYED` via `findStatusMessage`.
- Helpers: `src/aquecedor/delivery-verify.helpers.ts`.
