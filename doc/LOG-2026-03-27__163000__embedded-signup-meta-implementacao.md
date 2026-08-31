# LOG: Embedded Signup (Conectar com Meta) — implementação

## Objetivo

Fluxo oficial **WhatsApp Embedded Signup**: botão na aba **API Meta - Ativos**, SDK Facebook, troca server-side do `code` por **business token**, preenchimento de token/WABA/phone ID e tentativa de **subscribed_apps** nos webhooks.

## Backend (`src/index.ts`)

| Método | Rota | Função |
|--------|------|--------|
| GET | `/meta-oficial/embedded-signup/config` | Expõe `appId`, `configId`, `graphVersion` (sem secrets). `ok` quando `META_APP_ID` e `META_ES_CONFIG_ID` existem. |
| POST | `/meta-oficial/embedded-signup/exchange-code` | Body `{ code }`. `GET .../oauth/access_token` com `META_APP_ID`, `META_APP_SECRET`, `code`. |
| POST | `/meta-oficial/embedded-signup/subscribe-webhooks` | Body `{ token, wabaId }`. Espelha lógica de `subscribed-apps/ensure` (GET + POST `subscribed_fields`). |

## Variáveis de ambiente

- `META_APP_ID` — App Dashboard (topo).
- `META_APP_SECRET` — Basic settings (somente servidor).
- `META_ES_CONFIG_ID` — Facebook Login for Business → Configurations (template Embedded Signup).

Opcional já existente: `META_GRAPH_VERSION` (default `v22.0`), `META_GRAPH_BASE`.

## Frontend (`index.html`)

- Bootstrap: após carregar `/meta-oficial/embedded-signup/config`, define `fbAsyncInit` e injeta `https://connect.facebook.net/pt_BR/sdk.js`.
- Listener `window.message` para `type === 'WA_EMBEDDED_SIGNUP'` (origem `*facebook.com`), mescla `code` (callback `FB.login`) com `waba_id` / `phone_number_id` do postMessage; **TTL do código ~30s** — finalize imediato.
- Botão **Conectar com Meta (Embedded Signup)**.
- Lock `metaEsExchangeInFlight` evita troca duplicada.

## Configuração Meta (manual do provedor, uma vez)

1. App tipo **Business**, produto **WhatsApp** + **Facebook Login for Business**.
2. Criar **Configuration** a partir do template Embedded Signup; copiar **Configuration ID** → `META_ES_CONFIG_ID`.
3. Em **Client OAuth**, adicionar domínio com **HTTPS** e redirect URIs conforme doc.
4. **App Review** para permissões avançadas em produção.

## Validação

- `npm run build`
- Com env preenchido: botão abre popup; ao concluir, campos da etapa 2/3 preenchidos e status de sucesso.

## Palavras-chave

embedded-signup, META_ES_CONFIG_ID, WA_EMBEDDED_SIGNUP, exchange-code, business token
