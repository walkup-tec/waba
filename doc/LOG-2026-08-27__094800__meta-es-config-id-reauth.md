# LOG — Meta Embedded Signup: config_id perdido após reauth

## Contexto do pedido

Após o primeiro diálogo OAuth correto (`config_id` presente), a Meta pedia senha de novo e o segundo `dialog/oauth` falhava com «config_id é obrigatório» / «esse app não está disponível».

Auditoria e correção somente deste bug. Sem commit, push ou deploy.

## Comandos / ações

- Auditoria de `FB.login`, `config_id`, `dialog/oauth`, `auth_type`, `rerequest` em `index.html` e backend.
- Implementação do helper `meta-es-fb-login` + testes.
- `GET /integrations/meta/whatsapp/config` público (sem secrets).
- `npm run test:meta-es-login` e `npm run build`.

## Solução implementada

1. **Causa raiz (produção):** `wabaConnectMetaWhatsappOficial` chamava `FB.init` de novo no clique. A doc do JS SDK reserva `FB.init` para `fbAsyncInit` uma vez. Re-init força reauth; o segundo OAuth interno da Meta sai **sem** `config_id`.
2. **Fonte do Config ID:** o fluxo novo lê só `GET /integrations/meta/whatsapp/config` (`META_CONFIG_ID` com fallback `META_ES_CONFIG_ID`). Sem hardcode no front.
3. **Único invocador de `FB.login`:** helper que sempre envia `config_id`, `response_type: "code"`, `override_default_response_type: true`, `extras.setup` + `sessionInfoVersion: "3"`. Retry de reauth reutiliza as mesmas opções.
4. **Bloqueio:** sem `configId` o popup não abre; mensagem «Configuração do WhatsApp Embedded Signup indisponível.»
5. **Sem OAuth genérico** e sem `exchange-code` legado no botão «Conectar WhatsApp».

## Arquivos criados/alterados

- `src/integrations/meta-whatsapp/meta-es-fb-login.ts` (novo)
- `src/integrations/meta-whatsapp/meta-es-fb-login.test.ts` (novo)
- `src/index.ts` — GET público `/integrations/meta/whatsapp/config`
- `src/auth/waba-auth.routes.ts` — bypass GET/HEAD do config
- `index.html` — helper, SDK, Tech Provider, legado
- `package.json` — script `test:meta-es-login`
- `dist/` via build

## Como validar

1. `npm run test:meta-es-login`
2. `npm run build`
3. Em HTTPS de produção (após deploy futuro): clicar «Conectar WhatsApp» e conferir logs `[META][ES][START]` / `[META][ES][FB_LOGIN]` com `configIdPresent=true`. O segundo diálogo após senha deve manter Embedded Signup.
4. Sem `configId`: popup não abre.

Ainda depende de validação humana no Facebook Login (reauth real). Commit/push/deploy não feitos.

## Observações de segurança

Resposta pública: `appId`, `configId`, `graphVersion`, `callbackPath`. Sem `APP_SECRET`, token, code ou encryption key. Logs só com presença e last4 do Config ID.

## Palavras-chave

`config_id`, `FB.login`, `FB.init`, `reauth`, `Embedded Signup`, `META_CONFIG_ID`, `dialog/oauth`, `sessionInfoVersion`
