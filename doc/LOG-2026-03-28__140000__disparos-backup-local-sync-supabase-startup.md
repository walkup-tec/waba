# Disparador — backup local, sync completo na subida, hidratação que atualiza memória

## Contexto

Campanhas «sumiam» após restart ou não batiam com o Supabase: antes só existia reidratação parcial (`running` apenas) e `hydrateCampaignFromDbIfNeeded` **retornava cedo** se o id já estivesse na memória — sem atualizar `sent_count`/leads do Postgres. Inserts no Supabase falhavam em **silêncio** (`catch` vazio). Não havia arquivo de backup em disco em `data/`.

## O que mudou

1. **`data/disparos-local-state.json`** (fora do git — pasta `data/` no `.gitignore`): fila serializada `queuePersistDisparosLocalState` após criar/alterar/excluir campanha, envio/falha de lead, pausa global, etc.

2. **`loadDisparosLocalState()`** na subida do servidor **antes** do sync com o banco.

3. **`syncDisparosCampaignsFromDbOnStartup()`** — lê até 200 ids de `disparos_campaigns` e, para cada um, sincroniza com memória (substitui o antigo «só running»).

4. **`hydrateCampaignFromDbIfNeeded`** — se a campanha **já** está na memória, **atualiza** cabeçalho e, se o Postgres devolver leads, **substitui** os leads em memória; opção `skipQueueLocalPersist` no batch de startup.

5. **Log explícito** quando insert campanha/leads no Supabase falha.

## Limitação honesta

Não é possível recuperar campanhas que existiram **só na RAM** depois que o processo Node foi encerrado **e** nunca foram gravadas (nem no Supabase nem no arquivo — o arquivo só passa a existir após esta versão).

## Arquivos

- `src/index.ts`

## Palavras-chave

`disparos-local-state.json`, `syncDisparosCampaignsFromDbOnStartup`, `hydrateCampaignFromDbIfNeeded`, backup-campanhas
