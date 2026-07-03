# Fix — `waba_disparador` oscilando verde/amarelo

## Contexto

O serviço `waba_disparador` no Easypanel estava alternando entre verde e amarelo. O objetivo era descobrir a causa e corrigir sem tocar em dados de produção.

## Diagnóstico

- `GET https://waba.draxsistemas.com.br/health` respondeu `200` de forma consistente em probes externos.
- `serverBootId` permaneceu estável durante a amostragem, indicando **sem restart loop evidente** no processo Node.
- Acesso SSH automático ao VPS **não estava disponível** neste ambiente (`Permission denied (publickey,password)`), então a análise foi feita por código + probes HTTP públicos.
- O `Dockerfile` estava usando:
  - `HEALTHCHECK` contra `GET /health`
  - `timeout=5s`
  - `start-period=60s`
  - `retries=5`

## Causa raiz provável

O endpoint `GET /health` é **diagnóstico**, não apenas liveness/readiness:

- retorna payload grande;
- inclui `dataPersistence`;
- chama `getProductionDataPersistenceSnapshot()`;
- faz `readdirSync`, `existsSync`, `statSync`, `accessSync` em `/app/data`.

Em VPS com I/O variável e volume ativo, isso pode gerar falhas intermitentes no healthcheck do container, mesmo quando o app continua atendendo normalmente. O sintoma no Easypanel é exatamente alternar verde/amarelo.

## Correção aplicada

### `Dockerfile`

- `HEALTHCHECK` trocado de `/health` para `/ready`
- timeout Docker: `5s` -> `10s`
- start period: `60s` -> `90s`
- retries: `5` -> `6`
- adicionado timeout interno do request (`4000ms`) no script Node do healthcheck

### Deploy marker

- `src/deploy-marker.ts` atualizado para:
  - `DEPLOY-2026-07-03-healthcheck-ready-waba-disparador`

## Arquivos alterados

- `Dockerfile`
- `src/deploy-marker.ts`
- `dist/deploy-marker.js`
- `doc/memoria.md`

## Comandos executados

- `npm run build`
- probes HTTP públicos em `/health`
- tentativa de SSH: `ssh -o BatchMode=yes ...` (sem credencial disponível)

## Validação

1. Fazer deploy do serviço `waba_disparador`.
2. Confirmar `GET /health` com marker:
   - `DEPLOY-2026-07-03-healthcheck-ready-waba-disparador`
3. Verificar no Easypanel se o serviço deixa de alternar entre verde/amarelo.
4. Se ainda oscilar, o próximo passo é coletar no VPS:
   - `docker service ps waba_waba_disparador --no-trunc`
   - `docker inspect <container> --format '{{json .State.Health}}'`
   - `docker logs --since 15m <container>`

## Segurança

- Nenhum segredo exposto.
- Nenhuma ação destrutiva em Docker/volume foi executada.
- `/app/data` não foi tocado.

## Pendências

- O workspace possui arquivos não relacionados já sujos/não rastreados; eles não foram incluídos nesta correção.
- Falta commit/push/deploy desta correção para produção.

## Palavras-chave

`waba_disparador`, `HEALTHCHECK`, `/ready`, `/health`, `Easypanel amarelo`, `serverBootId`, `dataPersistence`
