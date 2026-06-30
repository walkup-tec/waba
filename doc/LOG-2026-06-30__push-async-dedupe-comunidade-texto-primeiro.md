# Push — envio assíncrono, anti-duplicidade e comunidade texto primeiro

**Data:** 2026-06-30

## Contexto do pedido

- Mensagem assustadora: *"Conexão interrompida com o servidor. Se marcou Comunidade ou E-mail…"*
- E-mail em duplicidade (intervalo de poucos segundos)
- Mensagem não entregue na comunidade WhatsApp
- Remover da UI: `Grupo anúncios: … · N instância(s) na Evolution`

## Solução implementada

### 1. Envio assíncrono (evita timeout do browser)

- `POST /admin/push/send` retorna **202 Accepted** com `message` em status `sending`
- Entrega (comunidade + e-mail) roda em background via `acceptPushMessage`
- Novo `GET /admin/push/messages/:id` para polling do status final
- Frontend faz poll a cada 2s até `sent` / `partial` / `failed` (até 3 min)

### 2. Anti-duplicidade reforçada

- Dedupe estendido para **90s** e inclui **título** no fingerprint
- Status `sending` também bloqueia reenvio imediato
- `pushInFlightFingerprints` impede dois envios simultâneos do mesmo conteúdo
- `adminPushSendInFlight = true` no início de `sendAdminPush` (antes das validações longas)

### 3. Comunidade — texto antes da imagem

- Com imagem: envia **texto primeiro** (com fallback de instâncias), depois tenta mídia
- Mídia enviada sem caption duplicado (`message: ""`)
- Se texto OK e imagem falhar → `ok: true` com detalhe explicando falha da imagem
- Texto-only também usa fallback de instâncias ranqueadas

### 4. UI

- Removida linha `Grupo anúncios: … · N instância(s)` (`#admin-push-community-extra` oculto)
- Mensagem de erro de rede simplificada (sem texto longo sobre segundo plano)
- Histórico exibe status `Enviando…` enquanto `sending`

## Arquivos alterados

- `src/push/waba-push-delivery.service.ts` — `acceptPushMessage`, dedupe, background delivery
- `src/push/waba-push.types.ts` — status `sending`
- `src/push/waba-push-community.service.ts` — texto primeiro + fallbacks
- `src/admin/waba-admin-push.service.ts` — `getMessageById`, usa `acceptPushMessage`
- `src/admin/waba-admin.routes.ts` — 202 + `GET /admin/push/messages/:id`
- `index.html` — poll, UI comunidade, mensagens de erro

## Como validar

1. `npm run build`
2. Master → Suporte → Push: enviar com Comunidade + E-mail
3. Confirmar resposta rápida (202) e conclusão via poll
4. Reclicar Enviar em <90s → "duplicata ignorada"
5. Comunidade com imagem: texto deve aparecer mesmo se imagem falhar
6. `#admin-push-community-extra` não deve mostrar JID/contagem Evolution

## Segurança

- `GET /admin/push/messages/:id` restrito a master (mesmo gate das demais rotas push admin)
- Sem exposição de segredos Evolution

## Palavras-chave

`push-async`, `push-dedupe`, `push-poll`, `comunidade-texto-primeiro`, `admin-push-community-extra`
