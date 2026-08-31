# LOG — Validação CONFIRMAR v3 + UI passo 3 + UTF-8

**Data:** 2026-06-21

## Pedido

Deploy anterior não removeu links «Já enviei CONFIRMAR» / «Abrir conversa no WhatsApp»; validação passo 3 continua expirando; mensagens com mojibake UTF-8 (`n├║mero`). Aplicar para assinantes e master (modal único `#register-instance-overlay`).

## Causa raiz

1. **UI:** alteração de cleanup estava só local — produção servia `index.html` antigo (commit anterior era só ownership).
2. **Validação:** commit `7193069` reverteu `instance-inbound-validation.service.ts` para lógica `a41ba4b` (strict `fromMe === false`, só `findMessages`, sem `findChats`, sem `refreshInboundValidation` no GET).
3. **UTF-8:** arquivo salvo com mojibake em strings user-facing e resposta WhatsApp automática.

## Solução

### Backend

- Restaurado serviço de **`084691e`** com strings UTF-8 corrigidas:
  - `isInboundCandidate` (`fromMe !== true`)
  - `findChats` + `findMessages` multi-URL
  - `refreshInboundValidation(validationId, aggressive)`
  - `resolveEvoInstancePhone`, `resolveWabaPublicBaseUrl`
  - timeout 10 min, poll 600ms no loop interno
- `GET /instancias/validacao-inbound/:id?nudge=2` → refresh agressivo
- `POST` aceita `forceRestart: true`

### Frontend (`index.html`)

- Links **removidos** (confirmado: sem `#register-inbound-sent-btn` / `#register-inbound-wa-open`)
- Poll **800ms** com `?nudge=2` automático (sem botão manual)
- Marker wizard: `DEPLOY-2026-06-21-validacao-inbound-confirmar-v3`

### Deploy marker

`DEPLOY-2026-06-21-validacao-inbound-confirmar-v3`

## Validar

1. `GET /health` → marker v3
2. Ctrl+F5 → passo 3 **sem** links «Já enviei» / «Abrir conversa»
3. Enviar CONFIRMAR de outro celular → OK em segundos
4. Toast de timeout com acentos corretos (`número`, `instância`)

## Palavras-chave

validacao-inbound, CONFIRMAR, findChats, nudge, UTF-8, register-inbound, passo 3
