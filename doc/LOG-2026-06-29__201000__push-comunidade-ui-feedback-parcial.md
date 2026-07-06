# LOG: Push — UI instância Evolution + feedback parcial

## Contexto

Continuação do fix da comunidade WhatsApp: após auto-resolve da instância Evolution, a UI ainda mostrava nome fixo e tratava envio `partial` como sucesso total.

## Solução

### Backend
- `loadPushCommunityConfigForAdmin()` — resolve instância na Evolution ao carregar config; retorna `config` + `evoInstancesAvailable`.
- `GET /admin/push/community-config` — assíncrono; persiste instância corrigida antes do primeiro envio.

### Frontend (`index.html`)
- `#admin-push-community-instance` — nome real da instância ao abrir aba Push.
- `loadAdminPushCommunityConfig()` — chamado no switch para `admin-push`.
- `formatAdminPushSendOutcome()` — distingue `sent`, `partial` (warning) e falha total (error); exibe detalhe da comunidade/e-mail.
- Histórico: status **Parcial** com tooltip do erro da comunidade.

## Arquivos

- `src/push/waba-push-community.service.ts`
- `src/admin/waba-admin-push.service.ts`
- `src/admin/waba-admin.routes.ts`
- `index.html`, `dist/*`

## Validar

1. Abrir Push → instância exibida deve bater com Evolution (não mais texto fixo).
2. Enviar assinantes + comunidade com comunidade falhando → warning “Push enviado parcialmente…”.
3. Só comunidade falhando → error claro com detalhe Evolution.

## Palavras-chave

`community-config`, `partial`, `formatAdminPushSendOutcome`, push feedback
