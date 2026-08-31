# LOG — Preservação de dados em deploy produção

## Pedido

Garantir que deploys não apaguem dados imputados: assinantes, campanhas, usuários, dashboard, financeiro, suporte, créditos.

## Implementado

1. **Doc** `doc/deploy-preservacao-dados-producao.md` — mapa arquivo × área, checklist Easypanel, riscos.
2. **`GET /health`** → campo `dataPersistence` (catálogo de arquivos críticos, writable, tamanhos).
3. **`scripts/backup-production-data.mjs`** — backup de `/app/data` → `_backups/`.
4. **`scripts/verify-production-data-safety.mjs`** — valida Dockerfile e bundle FTP.
5. **`bundle:ftp`** — não copia mais `data/` local; só `LEIA-ME-NAO-SOBRESCREVER.txt`.
6. **GitHub FTP** — `exclude: **/data/**`.

## Easypanel (obrigatório)

Volume persistente montado em **`/app/data`**. Redeploy sem apagar volume.

## Validar

`curl .../health` → `dataPersistence.dataDirWritable` e arquivos `exists: true`.

Marker: `DEPLOY-2026-06-24-preservacao-dados-producao`
