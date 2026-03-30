# Garantias de durabilidade — Disparador e Aquecedor (porta 3000)

Nenhum software oferece **zero perda** se o disco, o Postgres ou o processo forem destruídos sem backup externo. Abaixo está o **modelo operacional** deste projeto e o que você deve fazer para chegar perto de “nunca perder”.

## Disparador — campanhas e leads

| Camada | O que guarda | Quando |
|--------|----------------|--------|
| **Postgres (Supabase)** | `disparos_campaigns`, `disparos_campaign_leads` | Cada criação/alteração de estado/envio, se o insert/update funcionar. |
| **Disco local** | `data/disparos-local-state.json` | Após mutações e a cada **checkpoint** (padrão **120 s**; env `DISPAROS_CHECKPOINT_MS`, mínimo 30 s). |
| **Memória** | Arrays em processo Node | Volátil até o próximo checkpoint ou evento que grave disco. |

Na **subida** do servidor: lê o JSON local e **sincroniza até 200 campanhas** do Supabase na memória.

**Resposta ao criar campanha** inclui `durability.localStateFile` e `durability.supabase` para você ver se o Postgres aceitou o insert.

**Requisitos para não “sumir” de novo**

1. Rodar o DDL das tabelas no Supabase (`doc/SQL-2026-03-28__create-disparos-campaigns-only.sql` ou script completo).
2. `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` corretos no `.env` do processo da porta 3000.
3. **Backup do diretório `data/`** no robocopy/espelho (a pasta está no `.gitignore`).

## Aquecedor

| Camada | O que guarda |
|--------|----------------|
| **Postgres** | `aquecedor_config`, fila `aquecedor` (mensagens PENDENTE/PROCESSANDO/enviadas conforme schema). |
| **Disco local** | `data/runtime-intent.json` — último **Iniciar** / **Parar** explícito do motor (não afeta `run-once` / teste único). |

Na **subida**, se `runtime-intent.json` indicar **ligado** e o processo for de **produção** (`ENABLE_BACKGROUND_PROCESSING` e fora de manutenção), o aquecedor **volta a rodar** sozinho.

**Parar envios** (`POST /disparos/parar-envios`) grava intenção **desligada** para o aquecedor e pausa campanhas — após restart o motor **não** sobe até novo **Iniciar**.

## O que ainda não é “eterno”

- **Disco cheio** ou permissão negada em `data/` → falha no log; trate monitoramento.
- **Supabase apagado / projeto errado** → confira env e backups do provedor (PITR, se contratado).
- **Dois processos Node na mesma porta** → evite; use um único serviço na 3000.

## Palavras-chave

`disparos-local-state.json`, `runtime-intent.json`, `DISPAROS_CHECKPOINT_MS`, durabilidade-disparador, durabilidade-aquecedor
