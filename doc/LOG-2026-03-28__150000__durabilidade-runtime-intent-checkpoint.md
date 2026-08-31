# Durabilidade — runtime-intent aquecedor + checkpoint campanhas

## Pedido

Garantir que o ambiente na porta 3000 não “perca” campanhas nem o aquecedor.

## Implementado

- **`data/runtime-intent.json`**: `aquecedorRuntimeDesired` gravado em `POST /aquecedor/start` (true), `POST /aquecedor/stop` (false), e `stopAllDispatchActivityOnServer` / `POST /disparos/parar-envios` (false). Na subida, se true e `ENABLE_BACKGROUND_PROCESSING` e não manutenção → `startAquecedorRuntime()`.
- **Checkpoint**: `setInterval` a cada `DISPAROS_CHECKPOINT_MS` (default 120000, mínimo 30000, env `DISPAROS_CHECKPOINT_MS`) chama `queuePersistDisparosLocalState`.
- **Criar campanha**: resposta JSON com `durability.localStateFile` e `durability.supabase`.

## Documentação

- `doc/garantias-durabilidade-disparador-aquecedor.md`

## Arquivo

- `src/index.ts`

## Palavras-chave

`runtime-intent.json`, `DISPAROS_CHECKPOINT_MS`, `persistAquecedorRuntimeDesired`, durabilidade
