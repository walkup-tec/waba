# LOG — Investigação validação 5182001321 (>2 min travado)

**Data:** 2026-07-01  
**Número:** +55 51 8200-1321 (`5182001321`)

## Sintoma

Passo 3 do wizard ficou >2 min em «Recepção da mensagem — Processando», texto «consulta periódica na Evolution» (deploy anterior à troca de marca).

## Diagnóstico (probe produção)

### Instâncias Evolution com o mesmo número (3)

| Nome | connectionState | findChats | findMessages | Webhook antes do fix |
|------|-----------------|-----------|--------------|----------------------|
| `1321-01` | open | **0 chats** | **0 msgs** | não configurado |
| `1321` | open | **0 chats** | **0 msgs** | não configurado |
| `1311` | connecting | 0 | 0 | não configurado |

### Causa raiz

1. **`ensureInstanceWebhook` falhava com HTTP 400** — body enviava `events: ["MESSAGES_UPSERT", "messages.upsert"]`; a Evolution rejeita `messages.upsert` (não é enum válido).
2. Com **webhook desligado** + **histórico vazio** na API (`findChats`/`findMessages` retornam `[]`), o WABA **não tinha como ver** o CONFIRMAR enviado — só polling periódico inútil.
3. Instância **nova/recém-conectada** — mensagens ainda não indexadas na EVO; dependência total do webhook `MESSAGES_UPSERT`.

### Correção aplicada

- `src/instance-inbound-validation.service.ts`: `events: ["MESSAGES_UPSERT"]` apenas.
- Teste manual: `POST webhook/set/1321` → **HTTP 201**, webhook apontando para `https://waba.draxsistemas.com.br/webhooks/evolution`.

### Deploy em produção no momento do teste

- Marker: `DEPLOY-2026-07-01-validacao-confirmar-poll-nudge-fix` (anterior ao fix de webhook).

## Como validar após deploy

1. Reintegrar ou repetir passo 3 na instância `1321` (ou nome técnico usado no painel).
2. Confirmar webhook: `GET .../webhook/find/1321` → `enabled: true`.
3. Enviar CONFIRMAR do outro WhatsApp **após** iniciar passo 3 → recepção OK em segundos.

## Palavras-chave

`5182001321`, `1321`, `webhook`, `MESSAGES_UPSERT`, `findChats vazio`, `validacao-inbound`
