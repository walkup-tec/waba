# Validação CONFIRMAR — modal Sim/Não após 20s

**Data:** 2026-07-01  
**Marker:** `DEPLOY-2026-07-01-validacao-confirmar-modal-sim-nao`

## Contexto

Integração **5181082477** demorou **4m51s** travada na etapa 3. Webhook/polling automático não dava feedback claro ao usuário.

## Solução

### UX (passo 3 do wizard)

1. Primeiros **20s**: spinner e texto de processamento (como antes).
2. Após 20s: pergunta no modal — **«Você já enviou a mensagem CONFIRMAR?»** com botões **Sim, já enviei** / **Ainda não**.
3. **Sim** → `POST /instancias/validacao-inbound/:id/confirmar-envio` → busca agressiva na Evolution (`findMessages` + `findChats.lastMessage`, deep/aggressive).
4. **Não** → oculta pergunta, lembrete para enviar; pergunta reaparece em +20s.
5. Polling automático mantido a cada **300ms** com `?nudge=1|2` em paralelo.

### Backend

- `confirmUserSentInbound()` em `instance-inbound-validation.service.ts`
- Rota `POST .../confirmar-envio`
- GET validação com `nudge` (paridade origin/master)
- Serviço de validação atualizado (webhook `instance` objeto, `@lid` findChats)

## Arquivos

- `src/instance-inbound-validation.service.ts`
- `src/index.ts`
- `index.html` + `dist/`
- `src/deploy-marker.ts`

## Validar

1. Redeploy Easypanel → `/health` = `DEPLOY-2026-07-01-validacao-confirmar-modal-sim-nao`
2. Integrar instância → passo 3 → após 20s ver pergunta Sim/Não
3. Enviar CONFIRMAR de outro WhatsApp → **Sim** → recepção OK em segundos
4. Testar **5181082477** (@lid) e instância nova sem histórico

## Palavras-chave

validacao-inbound, CONFIRMAR, modal sim nao, confirmar-envio, findChats, webhook instance objeto
