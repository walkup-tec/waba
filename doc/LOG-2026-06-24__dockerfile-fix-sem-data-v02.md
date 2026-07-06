# LOG — Fix Docker build Easypanel (data/v02 not found)

## Erro

```
COPY data/v02 ./data/v02
ERROR: "/data/v02": not found
```

## Causa

- `data/` está no `.gitignore` — `data/v02` não vai para o Git nem para o contexto Docker.
- `.dockerignore` também exclui `data`.

## Correção

- Removido `COPY data/v02` do `Dockerfile`.
- Mantido `COPY scripts` (promote remoto via API após deploy).
- Promover Mozart em produção: máquina local com `data/v02`:
  ```bash
  node scripts/promote-subscriber-v02-to-production.cjs mozart.pmo@gmail.com --remote https://waba.draxsistemas.com.br
  ```

Marker: `DEPLOY-2026-06-24-dockerfile-sem-data-v02`
