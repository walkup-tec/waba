---
title: backend-saas-api-senior reference
---

# Reference (DTO, erros e tenant boundary)

## Tenant boundary (obrigatorio)

1. `tenant_id` deve existir no contexto de autenticacao e ser obtido antes de qualquer operacao.
2. O `controller` deve repassar `tenant_id` para o `service`.
3. O `service` deve repassar `tenant_id` para o `repository`.
4. O `repository` deve aplicar `tenant_id` nas queries:
   - leituras: `WHERE tenant_id = ...`
   - atualizacoes/deletions: `WHERE tenant_id = ... AND id = ...`
5. Para mutacoes, o service deve garantir pertencimento do recurso ao tenant (na pratica isso pode ser:
   - checagem por leitura do recurso com `tenant_id`
   - ou somente executar a mutacao com condicoes que incluam `tenant_id` e validar o caso "nao encontrado").

## Padrao de DTOs (entrada/saida)

Use DTOs para explicitar contrato e evitar acoplamento do controller com regra de negocio.

- DTO de entrada (`CreateXInput` / `UpdateXInput`)
  - campos obrigatorios
  - tipos
  - limites (ex.: strings max 255, numeros range)
  - regras de validação (ex.: formato, unicidade quando aplicavel)
- DTO de saida (`XResponse` / `ListXResponse`)
  - retorno apenas de campos permitidos (evitar segredos)
  - campos calculados apenas quando necessario

## Padrao de erros (evitar vazamento)

Mapeie erros do service para respostas padrao do controller.

Sugestao (ajuste aos codigos usados no projeto):

- `400` erro de validacao de entrada
- `401` nao autenticado
- `403` autenticado, mas sem autorizacao para o tenant/recurso
- `404` recurso nao encontrado para aquele `tenant_id`
- `409` conflito de negocio (ex.: duplicidade)
- `500` erro interno (mensagem generica)

Regras:

1. mensagens de erro nao devem revelar detalhes sensiveis (ex.: chaves, schemas, SQL)
2. logs podem ser detalhados internamente, mas resposta ao cliente deve ser generica

## Autorizacao no service

Padrao recomendado:

1. validar entrada
2. recuperar recurso (quando houver) com `tenant_id`
3. se nao existir, tratar como `404` (ou `403`, conforme contrato do projeto)
4. aplicar mutacao
5. retornar DTO de saida

## Performance (guidelines praticas)

1. listar: sempre com paginação (limit/offset ou cursor) e ordenacao definida
2. evitar N+1: prefira joins/associacoes/batch na camada de repository
3. selecionar campos necessarios: nao fazer `select *`
4. quando fizer sentido, sugerir indices: `(tenant_id, <coluna>)`

