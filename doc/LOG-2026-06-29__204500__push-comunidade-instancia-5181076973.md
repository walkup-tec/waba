# LOG: Push comunidade — instância correta 5181076973 + probe Evolution

## Problema

Erro persistente após auto-resolve:

`The "Drax Sistemas 5181077770" instance does not exist`

**Causa raiz:** o número **5181077770** nunca existiu na Evolution. A instância admin documentada é **`Drax Sistemas 5181076973`** (`doc/LOG-2026-06-16__fix-instancias-sem-bypass-master.md`).

O auto-resolve anterior devolvia o nome errado quando `fetchInstances` falhava ou retornava vazio (`if (!names.length) return preferred`).

## Solução

1. **Default** → `Drax Sistemas 5181076973` (`waba-push.types.ts`).
2. **Migração** `waba-push-config.json`: limpa instância legada `5181077770` e `walkup`.
3. **`fetchEvoInstanceNames`**: fallbacks + cache `evo-instances-cache.json` + retries.
4. **`discoverPushCommunityInstanceWithGroups`**: em 404, testa `fetchAllGroups` em cada instância Drax até achar grupo de anúncios.
5. **Não retorna silenciosamente** o nome preferido se a lista Evolution estiver vazia.

## Env (opcional)

```env
WABA_PUSH_COMMUNITY_EVO_INSTANCE=Drax Sistemas 5181076973
WABA_PUSH_COMMUNITY_EVO_INSTANCE_FALLBACKS=Drax Sistemas 5181076973,drax-oficial
```

## Validar

Push com Comunidade → sem 404; log `[push] instância comunidade ajustada` ou `[push] comunidade descoberta via probe`.

## Palavras-chave

`5181076973`, `5181077770`, probe, fetchAllGroups, push comunidade
