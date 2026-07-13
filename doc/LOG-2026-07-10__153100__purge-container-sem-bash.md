# LOG — 2026-07-10 — Purge falhou: container sem bash

## Erro do usuário

```
OCI runtime exec failed: exec: "bash": executable file not found in $PATH
```

Container `waba_waba_disparador.*` é imagem Node mínima — só tem `sh`.

## Correção

Usar `docker exec ... sh -c` (não `bash -lc`).
Script: `scripts/purge-admin-menus-direct-vps-sh.sh`

## Palavras-chave

`bash not found`, `docker exec sh`, `purge admin`
