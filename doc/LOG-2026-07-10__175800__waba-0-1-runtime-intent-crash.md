# LOG — 2026-07-10 — waba 0/1: task Shutdown + crash runtime-intent rename

## Diagnóstico (service ps / logs)

- Task atual: `Desired State=Shutdown`, `Complete 22 minutes ago` — Swarm não manteve réplica Running após `docker restart`.
- Crash anterior: `ENOENT rename runtime-intent.json.tmp -> runtime-intent.json` em `aquecedor-owner-runtime.registry.js` (aquecedor mozart ligado).

## Recuperação imediata (VPS)

```bash
# 1) Volume do serviço
docker service inspect waba_waba_disparador --format '{{json .Spec.TaskTemplate.ContainerSpec.Mounts}}'

# 2) Garantir runtime-intent no volume (ajuste VOLUME_NAME se diferente)
VOL=$(docker volume ls -q | grep -E 'waba.*disparador|waba_disparador' | head -1)
echo "VOL=$VOL"
docker run --rm -v "$VOL":/data alpine sh -c '
  mkdir -p /data
  if [ ! -f /data/runtime-intent.json ]; then
    echo "{\"version\":3,\"owners\":{}}" > /data/runtime-intent.json
  fi
  ls -la /data/runtime-intent.json /data/waba-campaign-intakes.json /data/waba-financeiro-split-config.json
'

# 3) Recriar task
docker service update --force waba_waba_disparador
sleep 25
docker service ls | grep waba_disparador
curl -sS --max-time 10 http://127.0.0.1:30180/health
```

## Palavras-chave

`Shutdown Complete`, `runtime-intent ENOENT`, `service update --force`
