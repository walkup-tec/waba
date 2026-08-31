# LOG — QR Code: count:0 e Prisma 500 (recuperação)

## Contexto

Após fix GET `/instance/connect`, o wizard exibia:

1. `{"count":0}` — Evolution respondeu 200 sem imagem de QR (sessão vazia/travada).
2. `500 PrismaClientKnownRequestError` em `integrationSession.findFirst()` — erro interno do banco da Evolution.

A UI mostrava JSON bruto porque `resolveRegistrarQrcodeErrorMessage` priorizava `error.detail` em vez da mensagem resumida.

## Solução

### Backend (`src/index.ts`)

- Detecta `count:0` (`isEvoConnectEmptyQrDetail`) e mensagem amigável em `describeEvoQrFailure`.
- Polling connect: 6 rodadas com espera progressiva + restart intermediário.
- `prepareEvoInstanceForQrConnect`: aguarda 4s após logout/restart.
- Recuperação automática: em `count:0` ou erro Prisma/500 → `resetEvoInstanceForQr` (logout + delete) → recria instância → novo poll connect.

### Frontend (`index.html`)

- `resolveRegistrarQrcodeErrorMessage` prioriza mensagem resumida; traduz Prisma e count:0.

### Deploy marker

`DEPLOY-2026-06-30-qrcode-evo-count0-prisma-recovery`

## Se Prisma 500 persistir após redeploy

Ação no **Easypanel** (serviço Evolution, não WABA):

1. Reiniciar container Evolution.
2. Conferir PostgreSQL da Evolution (migrations, disco, conexão).
3. Logs do Evolution em `/evolution/dist/main.js` — `integrationSession`.

## Palavras-chave

`count:0`, `integrationSession`, `Prisma`, `qrcode recovery`, `resetEvoInstanceForQr`
