# LOG: Push comunidade — auto-resolução instância Evolution

## Contexto

Push com destino **Comunidade WhatsApp** falhava:

`Não foi possível listar grupos na Evolution (404): The "Drax Sistemas 5181077770" instance does not exist`

O nome padrão estava gravado em `waba-push-config.json`, mas a instância não existe com esse identificador na Evolution de produção.

## Solução

Em `waba-push-community.service.ts`:

1. **`fetchEvoInstanceNames()`** — lista instâncias via `/instance/fetchInstances`.
2. **`resolvePushCommunityEvoInstance()`** — se o nome configurado não existir, escolhe a melhor candidata (telefone `5181077770`, contém "Drax Sistemas" / "Drax", fallback `walkup`).
3. **Persistência** — grava instância corrigida em `waba-push-config.json` e limpa JID de anúncios (grupos são por instância).
4. **Retry** — ao listar grupos com 404, tenta resolver instância e repete uma vez.
5. **Env opcionais** (`.env.example`):
   - `WABA_PUSH_COMMUNITY_EVO_INSTANCE`
   - `WABA_PUSH_COMMUNITY_PHONE_HINT`
   - `WABA_PUSH_COMMUNITY_ANNOUNCEMENT_GROUP_JID` (pula listagem de grupos)

Erros da comunidade retornam `{ ok: false, detail }` sem derrubar push para assinantes/usuários/e-mail.

## Arquivos

- `src/push/waba-push-community.service.ts`
- `.env.example`
- `dist/push/waba-push-community.service.js` (build)

## Validar

1. Push só comunidade → deve usar instância Drax existente ou erro listando disponíveis.
2. Push assinantes + comunidade → assinantes recebem alerta mesmo se comunidade falhar (status `partial`).
3. Log servidor: `[push] instância comunidade ajustada automaticamente: "..." → "..."`

## Palavras-chave

`5181077770`, `fetchAllGroups`, `resolvePushCommunityEvoInstance`, Evolution 404, comunidade push
