# Fase 10 — Checklist operacional Tech Provider (sem App Review)

Data: 2026-08-25 16:15 (America/Sao_Paulo)

## Contexto do pedido

Validar o fluxo completo WhatsApp Cloud API / Tech Provider em ambiente real, **sem novas funcionalidades**. Transformar o que já existe em checklist reproduzível. Não alterar Evolution, aquecedor, campanhas, fornecedor, Asaas nem o LAB legado (exceto um guarda mínimo para não vazar token quando o Laboratório Tech Provider estiver ativo). Sem commit, push ou deploy.

## Correções mínimas feitas (bugs reais)

1. **Nada marcava `status=connected`.** Inbox, envio, templates, automação e `subscribe-webhooks` exigem `connected`. Foi adicionado Graph confirm:
   - `POST /integrations/meta/whatsapp/confirm`
   - Graph `GET /{WABA_ID}?fields=id` e `GET /{PHONE_NUMBER_ID}?fields=id,display_phone_number,verified_name,quality_rating,whatsapp_business_account`
   - Só então `status=connected`
2. **`POST /{WABA_ID}/subscribed_apps` não deve enviar `subscribed_fields`.** A documentação oficial usa `Authorization: Bearer` sem body; os campos são escolhidos no App Dashboard.
3. **Laboratório não tinha botão Tech Provider.** Foi adicionado `Conectar WhatsApp Oficial` em Laboratório → Conectar WhatsApp, usando só `/integrations/meta/whatsapp/*`.
4. Guarda: se o signup Tech Provider estiver ativo, o listener legado **não** troca code nem preenche `#meta-token-input`.

## Auditoria de ENV (nomes; sem valores)

### Obrigatórias — produção Tech Provider

| Variável | Uso |
|---|---|
| `META_APP_ID` | App Meta / FB.init / OAuth |
| `META_APP_SECRET` | Token exchange + HMAC webhook (`X-Hub-Signature-256`) |
| `META_CONFIG_ID` | Embedded Signup Config ID (`META_ES_CONFIG_ID` é fallback legado) |
| `META_TOKEN_ENCRYPTION_KEY` | AES-256-GCM, 32 bytes hex/base64. Sem isso o token não persiste |
| `META_WEBHOOK_VERIFY_TOKEN` | GET verify do webhook; mesmo valor no painel Meta; estável (não regenerar no restart) |
| `SUPABASE_URL` | Persistência |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend only; nunca no frontend |

### Recomendadas

| Variável | Uso |
|---|---|
| `META_BUSINESS_ID` | BM / portfolio; não substitui o claim do signup |
| `META_OAUTH_REDIRECT_URI` | Origem da SPA para o exchange do `code`. Implementado: origem, **sem path extra** |
| `META_GRAPH_VERSION` | Default `v22.0` se vazio |

### Opcionais

| Variável | Uso |
|---|---|
| `META_GRAPH_BASE` | Default `https://graph.facebook.com` |
| `META_INBOX_LIST_POLL_MS` | Default 8000, clamp 2000–30000 |
| `META_INBOX_THREAD_POLL_MS` | Default 3000, clamp 2000–30000 |

### Legado / LAB (não usar no fluxo Tech Provider)

| Variável / rota | Nota |
|---|---|
| `META_ES_CONFIG_ID` | Alias legado de `META_CONFIG_ID` |
| `/meta-oficial/*` | LAB legado; exchange devolve `accessToken` ao browser |
| `/meta-oficial/tokens/app-access` | Qualquer sessão autenticada; aceita `appSecret` do cliente; devolve token |
| `/meta-oficial/tokens/system-user-access` | Idem |

### Estado local (`.env` / `.env.v02`) — só SET/EMPTY/UNSET

- `META_APP_ID` EMPTY
- `META_APP_SECRET` EMPTY
- `META_BUSINESS_ID` UNSET
- `META_CONFIG_ID` UNSET
- `META_ES_CONFIG_ID` EMPTY
- `META_GRAPH_VERSION` SET
- `META_OAUTH_REDIRECT_URI` SET (33 chars → `https://waba.draxsistemas.com.br` sem barra final)
- `META_TOKEN_ENCRYPTION_KEY` UNSET
- `META_WEBHOOK_VERIFY_TOKEN` UNSET
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` SET

Produção EasyPanel **não foi auditada** nesta fase (sem SSH). O `/health` público está em `DEPLOY-2026-08-24-1650-leads-pj-pages-metric-v9.24` — Fases 5–10 **não** estão no ar.

## Migrations checklist

Confirmado no Supabase apontado pelo `.env.v02` (head select nas colunas; **0 linhas**):

| Tabela | Colunas posteriores verificadas |
|---|---|
| `meta_whatsapp_connections` | `status`, `waba_id`, `phone_number_id`, `quality_rating`, `last_webhook_at`, `access_token_encrypted` |
| `meta_whatsapp_webhook_events` | `event_key`, `tenant_id` |
| `meta_whatsapp_conversations` | `unread_count`, `human_takeover`, `last_message_preview`, `assigned_to` |
| `meta_whatsapp_messages` | `wamid`, `sent_at`, `delivered_at`, `read_at`, `failed_at`, `status`, `direction` |
| `meta_whatsapp_templates` | `name`, `status`, `language` |
| `meta_whatsapp_automation_settings` | `enabled`, `connection_id` |
| `meta_whatsapp_automation_flows` | `connection_id` |
| `meta_whatsapp_automation_rules` | `flow_id`, `priority` |
| `meta_whatsapp_automation_runs` | `message_id`, `status` |

Nenhuma migration destrutiva foi executada.

SQL no repo: `doc/SQL-2026-08-25__create-meta-whatsapp-*.sql` + `alter-meta-whatsapp-inbox-human-takeover.sql`.

## URLs públicas

| Uso | URL |
|---|---|
| APP / SPA | `https://waba.draxsistemas.com.br/` |
| Webhook Cloud API | `https://waba.draxsistemas.com.br/webhooks/meta/whatsapp` |
| OAuth / Embedded Signup (origem) | `https://waba.draxsistemas.com.br` (`META_OAUTH_REDIRECT_URI`) |
| Callback API (fallback, **não** é o redirect do FB.login atual) | `https://waba.draxsistemas.com.br/integrations/meta/whatsapp/callback` |
| Config pública (appId + configId, sem secret) | `GET /integrations/meta/whatsapp/config` |
| Política | `https://draxsistemas.com.br/politicameta/` — HTTP 200, atualizada 24/08/2026 |
| Termos | `https://draxsistemas.com.br/termos/` — **404** |
| Exclusão | `https://draxsistemas.com.br/exclusao/` e `/exclusao-de-dados/` — **404** |

**Embedded Signup atual:** `FB.login` na SPA (origem HTTPS). **Não** depende de redirect para `/callback`. Não inventar outro `redirect_uri`. Se a Meta exigir `redirect_uri` no exchange, usar exatamente `META_OAUTH_REDIRECT_URI`.

## HTTPS

- `https://waba.draxsistemas.com.br/` → 200, HTML, sem redirect loop observado.
- SDK Facebook: `https://connect.facebook.net` (sem mixed content previsto).
- Certificado aceito pelo cliente HTTPS (handshake OK).
- Webhook no ar hoje: **401** (rota nova ainda não está no deploy de produção). Depois do deploy esperado: token certo → 200 + challenge; token errado → 403.

## Webhook verify (manual, após deploy + env)

Não expor o token. Substituir `SEU_TOKEN` localmente:

```text
GET https://waba.draxsistemas.com.br/webhooks/meta/whatsapp?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=fase10-challenge
```

- Token correto + `hub.mode=subscribe` → **200** `text/plain` com o challenge.
- Token errado → **403** `Forbidden`.
- Hoje em produção, sem a rota: **401** sessão (middleware). Isso é evidência de que o código novo não está publicado.

## Meta Developers — checklist manual (não alteramos a conta)

1. **developers.facebook.com** → o App já existente (não criar outro).
2. **WhatsApp** → **Configuration**:
   - Callback URL: `https://waba.draxsistemas.com.br/webhooks/meta/whatsapp`
   - Verify Token: o mesmo de `META_WEBHOOK_VERIFY_TOKEN`
   - Webhook fields (mínimo alinhado ao parser): `messages`, `message_template_status_update`, `phone_number_quality_update`, `account_update`. Status de mensagem entra em `messages`.
3. **Facebook Login for Business** / Login:
   - Valid OAuth Redirect URIs: `https://waba.draxsistemas.com.br` (igual ao env; sem path inventado)
   - Allowed Domains / JavaScript SDK domain: `waba.draxsistemas.com.br`
4. **Embedded Signup** → Configuration → copiar **Config ID** para `META_CONFIG_ID`.
5. **App Mode:** Development até App Review. Não pedir Advanced Access agora.
6. **Settings → Basic:** Privacy Policy URL = `https://draxsistemas.com.br/politicameta/`. Terms e Data deletion ainda **não** têm URL válida.
7. **WhatsApp product** deve estar adicionado ao App.
8. Clicar **Verify** no webhook só depois do deploy com `META_WEBHOOK_VERIFY_TOKEN` e `META_APP_SECRET` no host.

## subscribed_apps (request correto, sem token)

```text
GET  https://graph.facebook.com/{META_GRAPH_VERSION}/{WABA_ID}/subscribed_apps
     Authorization: Bearer <TOKEN>

POST https://graph.facebook.com/{META_GRAPH_VERSION}/{WABA_ID}/subscribed_apps
     Authorization: Bearer <TOKEN>
     (sem body; sem subscribed_fields)
```

Body opcional oficial só para `override_callback_uri` + `verify_token`. O Waba **não** envia override: usa o callback do App Dashboard.

## Embedded Signup — o que o sistema registra (sanitizado)

Log na UI Laboratório, sem token:

```text
início
code recebido
token exchange concluído
WABA claimed
Phone claimed
Graph validation
connection status=connected
webhooks: inscrição concluída | já inscrito
```

Eventos de término da Meta (incluindo coexistência, se a Meta oferecer):

- `FINISH`
- `FINISH_ONLY_WABA`
- `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`
- `FINISH_GRANT_ONLY_API_ACCESS`
- `FINISH_OBO_MIGRATION`

`extras` do `FB.login`: `{ setup: {} }` — **não** força Coexistence.

## Teste com ativo já existente

Seguir a UI da Meta no popup. Se permitir selecionar WABA/número da BM, completar. Se bloquear, anotar a tela/passo (não criar número novo).

## Coexistence

Somente o que a Meta mostrar no Embedded Signup para um número já no WhatsApp Business App. Sem QR Evolution, sem device, sem endpoint não documentado. Resultado real: **PENDING** até o clique.

## Como validar (depois de env + deploy autorizados)

1. Preencher ENVs obrigatórias no EasyPanel (sem logar valores).
2. Deploy do código desta fase (autorização futura).
3. GET webhook verify (acima).
4. Login no Waba → Laboratório → Conectar WhatsApp → **Conectar WhatsApp Oficial**.
5. Completar popup Meta (ativo existente se aparecer).
6. Confirmar `status=connected` + Graph (nome / número / qualidade se houver).
7. **Inscrever webhooks** se o log não mostrar inscrição.
8. Enviar texto em **Teste de envio Cloud API** (MetaCloudProvider).
9. Aguardar webhooks `sent` / `delivered` / `read`.
10. Responder no WhatsApp de destino → Inbox.
11. Templates: Atualizar da Meta → criar um → status local. Envio de template só se `APPROVED`.
12. Automação: chatbot off → inbound sem auto-resposta → ligar → regra simples → inbound → takeover → parar → liberar → volta.

## Segurança

### Tech Provider (caminho novo)

- Token só cifrado no banco.
- Respostas passam por `stripMetaSecrets`.
- UI do Laboratório recusa payload com `access_token` / `authorization_code`.
- `GET /integrations/meta/whatsapp/config` é público mas só `appId` + `configId` + versão.

### LAB legado (separado; não removido)

- `#meta-token-input` recebe `accessToken` após `/meta-oficial/embedded-signup/exchange-code`.
- `POST /meta-oficial/tokens/app-access` e `.../system-user-access`: **qualquer usuário autenticado** (middleware de sessão, **não** só master), profile produção também, devolvem `accessToken` em JSON. Risco alto para App Review.
- Recomendação **antes** do App Review: restringir a master **ou** parar de devolver token. Não remover agora.

### frontend / storage / logs / dist

- `localStorage` / `sessionStorage`: o fluxo Tech Provider não grava token.
- Logs Tech Provider: eventos sem token.
- `dist/index.html` espelha a UI nova; o input de token legado continua no LAB legado.

## Integridade Meta

Pendência separada: **“Sua empresa foi bloqueada”**. Sem workaround. Bloqueia produção completa / App Review se persistir.

## App Review readiness

| Item | Classificação | Nota |
|---|---|---|
| whatsapp_business_messaging | PENDING | Código pronto; falta envio real em produção |
| whatsapp_business_management | PENDING | Idem |
| public_profile | PENDING | Conferir no painel do App |
| Embedded Signup | BLOCKED | Env vazio + código não deployado + possível integridade |
| Webhooks | BLOCKED | Produção responde 401 na URL nova |
| Templates | PENDING | Código + SQL prontos |
| Mensagem real | PENDING | Depende de connected + deploy |
| Inbox | PENDING | Código pronto |
| Automação | PENDING | SQL + testes 20/20; chatbot inicia desligado |
| Política | READY | `politicameta/` pública |
| Data deletion | BLOCKED | URLs 404; política §12 menciona exclusão sem página dedicada |
| Termos | BLOCKED | `/termos/` 404 |
| Integridade | BLOCKED | Bloqueio da empresa na Meta |

## Não feito (conforme pedido)

Commit, push, deploy, App Review, Advanced Access, nova BM, novo App, workaround de integridade.

## Arquivos alterados

- `src/integrations/meta-whatsapp/meta-whatsapp-connection.repository.ts` — `markConnected`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts` — `confirmFromAuth`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.types.ts` — `qualityRating` público
- `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts` — `POST .../confirm`
- `src/integrations/meta-whatsapp/meta-whatsapp-webhook-subscription.service.ts` — POST sem body
- `src/integrations/meta-whatsapp/meta-whatsapp-phase3.test.ts` / `phase5.test.ts`
- `index.html` + `dist/index.html` — botão Conectar WhatsApp Oficial
- `.env.example` — chaves documentadas (vazias)

## Testes

- `npm run test:meta-phase3` — 12/12 (inclui Graph → connected / 401 / WABA mismatch)
- `npm run test:meta-phase5` — 19/19 (POST subscribed_apps sem body)
