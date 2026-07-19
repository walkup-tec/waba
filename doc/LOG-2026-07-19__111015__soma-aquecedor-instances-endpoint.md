# LOG — Endpoint Soma: aquecedor-instances

## Contexto
Soma CRM precisa listar instâncias do aquecedor do owner `mozart.pmo@gmail.com`.

## Solução
- `GET /integrations/soma/aquecedor-instances`
- Header `X-Soma-Waba-Key` = `SOMA_WABA_INTEGRATION_KEY`
- Owner: `SOMA_WABA_OWNER_EMAIL` (default mozart.pmo@gmail.com)
- Auth bypass no middleware para este path

## Arquivos
- `src/auth/waba-auth.routes.ts`
- `src/index.ts` (+ `dist/` espelho)
- `.env.example`

## Keywords
soma, integração, aquecedor, instances
