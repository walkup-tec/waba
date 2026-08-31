# LOG — E-mail operacional: await, auditoria e reenvio

## Contexto

Campanha criada por `mozart.pmo@gmail.com` (API Oficial). Operacional esperado (`somaconecta@gmail.com`) não recebeu aviso de nova campanha.

Produção já tinha `mailConfigured: true` e `operacionalCampaignNotifyEnabled: true`, mas falhas SMTP eram fire-and-forget (`setImmediate`) e não ficavam registradas no intake.

## Causa raiz (roteamento + confiabilidade)

1. **Roteamento por plano:** o e-mail vai apenas para usuários `role: operacional` com `operacionalDispatchesApi` igual ao `apiKind` da campanha.
2. Wizard força `apiKind: oficial` → destinatário é o operacional **API Oficial** (V02: `digitalcorban@gmail.com`), não `somaconecta@gmail.com` (Alternativa).
3. Notify anterior era assíncrono sem `await` → falhas SMTP só em log do container, sem rastreio no intake.

## Solução implementada

1. `notifyOperacionalStaffOnCampaignCreated` agora é **async**, envia com `await` e retorna `OperacionalNotifyResult`.
2. `POST /disparos/campanhas/intake` aguarda o notify antes do 201; persiste `operacionalNotifyAudit` no intake; resposta inclui `operacionalNotify`.
3. `POST /admin/operacional/campanhas/:id/reenviar-email-operacional` para reenvio manual com erro explícito.
4. Retry SMTP transitório em `waba-mail-delivery.ts`.
5. Fallback de URL do app em `waba-app-url.ts`.
6. Toast de aviso no wizard se campanha criada mas e-mail operacional falhou ou sem destinatário.
7. Débito de créditos corrigido para `alternativa` também no intake.

## Arquivos alterados

- `src/mail/waba-operacional-campaign-notify.service.ts`
- `src/disparos/waba-campaign-intake.routes.ts`
- `src/disparos/waba-campaign-intake.repository.ts`
- `src/mail/waba-mail-delivery.ts`
- `src/mail/waba-app-url.ts`
- `src/users/waba-system-user.service.ts`
- `src/admin/waba-operacional-campanhas.routes.ts`
- `src/admin/waba-operacional-campanhas.service.ts`
- `src/deploy-marker.ts`
- `index.html` (toast aviso notify)
- `dist/` (build)

## Como validar

1. Deploy com marker `DEPLOY-2026-06-26-operacional-email-await-audit`.
2. Criar campanha teste API Oficial → resposta 201 deve trazer `operacionalNotify.recipients`.
3. Conferir intake em `waba-campaign-intakes.json` → campo `operacionalNotifyAudit`.
4. Se operacional Oficial for `digitalcorban`, e-mail **não** vai para `somaconecta` — ajustar em Admin · Usuários se a intenção for outro destinatário.
5. Reenvio: `POST /admin/operacional/campanhas/:id/reenviar-email-operacional` (staff operacional/master).

## Palavras-chave

`operacionalNotify`, `operacionalDispatchesApi`, `apiKind oficial`, `somaconecta`, `digitalcorban`, `SMTP await`, `reenviar-email-operacional`
