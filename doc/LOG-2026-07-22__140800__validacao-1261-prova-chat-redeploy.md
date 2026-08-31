# LOG — Validação 1261: prova no chat + Redeploy obrigatório

**Data:** 2026-07-22 14:08  
**Marker:** `DEPLOY-2026-07-22-validacao-1261-prova-chat`

## Contexto

Usuário reportou que o problema da integração **1261** (modal “ok” sem mensagem “Validação WABA concluída…” / Preparando instável) **continua** após push FTP.

## Causa raiz (por que “pedi N vezes”)

1. **FTP não reinicia o Node.** O `/health` em produção ainda reportava `DEPLOY-2026-07-18-data-snapshot-v02` — o processo em memória não carregou o `dist/` novo. Correção de código sem Redeploy = sintoma permanece.
2. **Sucesso falso no sendText:** mesmo com HTTP 201, a Evolution pode aceitar destino errado/`@lid` e a mensagem **não aparece** no chat do usuário. O backend marcava `sendTest.success=true` só com HTTP OK → UI fechava como validado.

## Correção

1. `buildSendNumberCandidates` — tenta variantes BR (com/sem 9º dígito) e JID telefone; nunca `@lid`.
2. `sendContextualReply` — após HTTP OK, **só** marca sucesso quando `findReplyInChat` encontra o marcador `WABA-VAL:…` / “Validação WABA concluída”.
3. Worker continua pollando prova no histórico se HTTP OK sem mensagem ainda.
4. Marker novo para confirmar no `/health` após Redeploy.

## Arquivos

- `src/instance-inbound-validation.service.ts` / `dist/…`
- `src/deploy-marker.ts` / `dist/deploy-marker.js`
- (já existente) lifecycle `forceNewIntegration` com `preparingSince=now`

## Como validar

1. Push `master` → Deploy FTP.
2. **Redeploy** Easypanel `waba_disparador` (obrigatório para Node).
3. Heal login se 502: watch/timer ou `heal-waba-login-vps.sh burst`.
4. `curl …/health` → `deployMarker` = `DEPLOY-2026-07-22-validacao-1261-prova-chat`.
5. Integrar 1261 (ou recriar): enviar CONFIRMAR → deve aparecer **Validação WABA concluída…** no WhatsApp; UI só fecha sucesso com isso.
6. Card deve permanecer **Preparando** ~6h.

## Palavras-chave

1261, validacao-inbound, sendText, prova chat, FTP sem restart, redeploy, deployMarker, @lid, 9 digito BR
