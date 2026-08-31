# LOG — Push: comunidade Evolution 500 + e-mail duplicado

**Data:** 2026-06-29

## Problemas reportados

1. Push parcial: **Comunidade** falha com `fetchAllGroups` HTTP 500 (`PrismaClientKnownRequestError` / `integrationSession.findFirst` na Evolution).
2. **E-mail** ainda chegando em duplicidade.

## Causas

### Comunidade 500
- Erro interno da **Evolution** na sessão WhatsApp da instância configurada (DB Prisma), não do WABA.
- O código só fazia fallback (probe em outras instâncias) em **404** de instância inexistente, não em **500**.

### E-mail duplicado
- Corrida entre dois `POST /admin/push/send` quase simultâneos (dedupe só após gravar histórico **depois** do envio).
- Resposta API sempre `deduplicated: false`.

## Correções

1. **`waba-push-community.service.ts`**
   - `isEvoGroupListRecoverableError`: trata 500 / integrationSession / Prisma como recuperável.
   - `recoverAnnouncementGroupAfterEvoFailure`: limpa JID cacheado, tenta outra instância + `discoverPushCommunityInstanceWithGroups`.
   - Mensagem orienta configurar `WABA_PUSH_COMMUNITY_ANNOUNCEMENT_GROUP_JID` ou reconectar instância na Evolution.

2. **`waba-push-delivery.service.ts`**
   - Fila `runPushSendLocked` serializa envios push no processo.
   - Grava registro `partial` **antes** de e-mail/comunidade (dedupe imediato).
   - Retorno `{ message, deduplicated }`.

3. **`waba-admin.routes.ts` + `index.html`**
   - Propaga `deduplicated: true` e aviso na UI.

4. **Deploy marker:** `DEPLOY-2026-06-29-push-comunidade-500-email-dedupe`

## Validar em produção

1. `GET /health` → `deployMarker` novo após redeploy Easypanel.
2. Push com Comunidade: se 500 na instância A, deve tentar `drax-oficial` / fallbacks ou usar JID fixo no `.env`.
3. Dois cliques rápidos em Enviar → segundo retorna dedupe, **um** e-mail por destinatário.

## Easypanel (recomendado se 500 persistir)

```env
WABA_PUSH_COMMUNITY_EVO_INSTANCE=Drax Sistemas 5181076973
WABA_PUSH_COMMUNITY_EVO_INSTANCE_FALLBACKS=Drax Sistemas 5181076973,drax-oficial
WABA_PUSH_COMMUNITY_ANNOUNCEMENT_GROUP_JID=<jid-do-grupo-anuncios>@g.us
EVO_SEND_TEXT_V1=1
```

Reconectar instância na Evolution se `integrationSession` continuar quebrado.

## Palavras-chave

`push`, `comunidade`, `fetchAllGroups`, `integrationSession`, `Prisma`, `email duplicado`, `dedupe`, `runPushSendLocked`
