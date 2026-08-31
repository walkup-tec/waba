# LOG — E-mail operacional não enviado (somaconecta / API Oficial)

**Data:** 2026-06-26  
**Marker:** `DEPLOY-2026-06-26-operacional-email-notify-fix`

## Pedido

Campanha **API Oficial** criada; operacional `somaconecta@gmail.com` não recebeu e-mail de nova campanha.

## Diagnóstico

### 1. Backend Node em produção desatualizado

`GET https://waba.draxsistemas.com.br/health` retornou:

- `deployMarker`: `DEPLOY-2026-06-26-browser-password-manager-guards`
- **Sem** `operacionalCampaignNotifyEnabled`, `mailConfigured`, `campaignIntakeSafeParser`

O hook `notifyOperacionalStaffOnCampaignCreated` e o template de e-mail existem no Git (`0bbe37a`+), mas **não estão rodando** no serviço Node até redeploy no Easypanel (`waba_disparador`). FTP só atualiza estáticos.

### 2. Designação operacional × plano da campanha

O e-mail vai **somente** para usuários com:

- `role === "operacional"`
- `operacionalDispatchesApi === apiKind` da campanha (`oficial` ou `alternativa`)

No ambiente V02 (referência):

| E-mail | Plano designado |
|--------|-----------------|
| `digitalcorban@gmail.com` | API Oficial |
| `somaconecta@gmail.com` | API Alternativa |

Campanha **API Oficial** → notifica `digitalcorban`, **não** `somaconecta`, salvo se Admin · Usuários tiver alterado o plano do operacional em produção.

### 3. SMTP

Se `MAIL_MODE`/`SMTP_*` não estiverem configurados no container, o envio é **skipped** (antes sem log visível).

## Correções no código

1. **`notifyOperacionalStaffOnCampaignCreated`** — `setImmediate` + `await` entrega com log de destinatários e resultado (sent/skipped/failed).
2. **`listOperacionalUsersForDispatchesApi`** — usa `ensureUserMigrated` na listagem.
3. **`GET /health`** — expõe `mailConfigured` e `operacionalCampaignNotifyEnabled: true`.
4. **`notifyOperacionalNewCampaignEmail`** — loga `skipped`/`failed` explicitamente.

## Como validar após redeploy

1. Easypanel → redeploy `waba_disparador`.
2. `curl https://waba.draxsistemas.com.br/health` → `deployMarker` = `DEPLOY-2026-06-26-operacional-email-notify-fix`, `mailConfigured: true`.
3. Admin · Usuários → confirmar qual operacional está em **API Oficial**.
4. Assinante gera campanha Oficial → operacional Oficial recebe e-mail (verificar spam).
5. Logs do container: `[mail] campanha <id> (API Oficial): notificando N operacional(is): ...`

## Palavras-chave

`operacional`, `email`, `somaconecta`, `digitalcorban`, `apiKind`, `operacionalDispatchesApi`, `SMTP`, `redeploy`, `health mailConfigured`
