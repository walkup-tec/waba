# Validação CONFIRMAR — @lid / findChats (5181082477)

## Contexto

Instância **5181082477** (`digital-corban-2477`) integrou com sucesso, mas a recepção de **CONFIRMAR** continuou lenta após o deploy `fast-detect`.

## Diagnóstico (probe produção)

| Item | Resultado |
|------|-----------|
| Instância EVO | `digital-corban-2477` — `open` |
| Deploy marker | `DEPLOY-2026-07-01-validacao-confirmar-fast-detect` |
| Webhook GET | `enabled=true`, URL WABA correta |
| `findMessages` global (`fromMe:false`) | **CONFIRMAR ausente** (50 records) |
| Top 25 chats `findMessages` por JID | **CONFIRMAR ausente** |
| Chats Evolution | **115 conversas**, muitas com `@lid` + `remoteJidAlt` |
| `findChats` | ~94ms — traz `lastMessage` completo por chat |

## Causa raiz

Mensagens em modo **@lid** (addressingMode `lid`) **não aparecem** no `findMessages` global que o fast path usava. Só eram encontradas em scan **deep** (findChats → findMessages por chat), a cada ~1,4s — daí a demora de dezenas de segundos.

Além disso, o webhook com `requireTimestamp: true` podia ignorar `MESSAGES_UPSERT` sem timestamp explícito.

## Solução

1. **`findInboundViaChatsLastMessage`** — em cada tick (~280ms), um único `findChats` ordenado por `updatedAt` e leitura de `lastMessage` (sem N×findMessages).
2. Fast path em **paralelo**: `findMessages` + `findChats.lastMessage`.
3. **Webhook ao vivo** — aceita upsert sem timestamp se evento é recente (grace 15s).
4. **`ensureInstanceWebhook`** — reconhece webhook já configurado via GET (não depende só do POST set).
5. **`ensureValidationInstanceOpen`** — espera máx. 12s (antes 45s).

Marker: `DEPLOY-2026-07-01-validacao-confirmar-lid-findchats`

## Validar

1. Redeploy Easypanel + `/health` marker novo.
2. Reintegrar ou passo 3 com `digital-corban-2477` / 5181082477.
3. Enviar CONFIRMAR → recepção OK em ~1–3s (webhook ou findChats-lastMessage).

## Palavras-chave

`5181082477`, `digital-corban-2477`, `@lid`, `findChats`, `lastMessage`, `remoteJidAlt`, `validacao-inbound`
