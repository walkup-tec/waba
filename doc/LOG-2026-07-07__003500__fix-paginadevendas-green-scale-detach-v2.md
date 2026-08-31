# LOG — fix paginadevendas green scale detach v2

**Data:** 2026-07-07 ~00:35 UTC  
**Commit:** `60fb7d7` — `fix: paginadevendas green script scale detach v2`

## Contexto / solicitação aberta

- Usuário rodou `/tmp/fix-paginadevendas-green.sh` (v1, commit `4631b91`) no VPS `srv1261237`
- Script **travou** em `docker service scale waba_paginadevendas=1` (sem `-d`)
- Antes do travamento: container `101369e96ee0`, homepage HTTP 200, Swarm **0/1**
- Objetivo: deixar **paginadevendas verde** no Easypanel (sem force update, sem OG)

## Causa raiz

`docker service scale` **sem detach** bloqueia até convergência 1/1. Com Swarm desincronizado (container órfão healthy + réplicas 0/1), o comando pode esperar indefinidamente.

## Alteração

Arquivo: `scripts/fix-paginadevendas-green-vps.sh` → versão `paginadevendas-green-2026-07-07-v2`

- `scale_service_detach()` usa `docker service scale -d`
- Se container primário já responde `/` = 200 e Health = healthy → **pula scale**
- Sucesso se HTTP 200 + healthy (mesmo com Swarm lagando 0/1)

## Comandos executados (local)

```bash
git commit -m "fix: paginadevendas green script scale detach v2"
git push origin master  # 4631b91..60fb7d7
```

## Próximos passos no VPS

1. **Ctrl+C** no terminal travado
2. Baixar v2 e rodar:
   ```bash
   wget -O /tmp/fix-paginadevendas-green.sh "https://raw.githubusercontent.com/walkup-tec/waba/60fb7d7/scripts/fix-paginadevendas-green-vps.sh"
   chmod +x /tmp/fix-paginadevendas-green.sh
   /tmp/fix-paginadevendas-green.sh
   ```
3. Se Easypanel ainda amarelo: Health Check path → `/` (não `/health` — retorna 404)
4. OG permanente: depois de verde estável

## Pendências

- Validar Easypanel verde após script v2
- OG wabadisparos (patch router ou repo fonte Vite + redeploy)
