# Log: etiquetas de instâncias na lista de campanhas — correções (porta 3000)

## Problema

Campanha em execução sem etiquetas verde/vermelha: causas prováveis:

1. `config_snapshot` ausente ou `selectedDisparadorInstances` vazio após ler o Postgres (coluna inexistente, JSON com chave `selected_disparador_instances`, etc.).
2. Query com `config_snapshot` falhando no PostgREST e resposta ignorada sem fallback.
3. Nome da instância no snapshot diferente do retorno da EVO (caixa).

## Ajustes

1. **`parseDisparosConfig`**: aceita também `selected_disparador_instances` (snake_case).
2. **`GET /disparos/campanhas`**: se o `select` com `config_snapshot` retornar `error`, repete a lista **sem** essa coluna para não perder campanhas.
3. **Fallback**: campanha `running` sem tags no snapshot mas com instâncias na **config global** (`disparos_config` Seção 1) → monta etiquetas a partir da seleção global; resposta inclui `disparadorInstancesFromGlobalFallback: true`.
4. **`isEvoInstanceMarkedConnected`**: compara nome com a EVO **case-insensitive**.
5. **UI**: aviso discreto quando as etiquetas vêm do fallback global.

## Validação

- `npm run build`; reiniciar processo na 3000.
- Conferir `GET /disparos/campanhas` → `disparadorInstances` preenchido.

## Palavras-chave

`disparadorInstances`, `config_snapshot`, `selected_disparador_instances`, fallback global, EVO case insensitive
