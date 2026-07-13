# LOG — 2026-07-10 — waba_disparador 0/1 após docker restart no purge

## Sintoma

```
curl 127.0.0.1:30180/health → Failed to connect
docker service ls → waba_waba_disparador 0/1  *:30180->80/tcp
```

## Causa

`docker restart` em container de task Swarm (`waba_waba_disparador.1.*`) encerra a task; se a nova não sobe (crash loop / pending), fica **0/1** e :30180 cai.

## Recuperação (VPS)

```bash
docker service ps waba_waba_disparador --no-trunc | head -15
docker service logs waba_waba_disparador --tail 80 2>&1 | tail -80
docker service update --force waba_waba_disparador
# aguardar 20-40s
docker service ls | grep waba_disparador
curl -sS --max-time 10 http://127.0.0.1:30180/health
```

Não force Traefik se Traefik estiver 1/1.

## Palavras-chave

`0/1`, `docker restart swarm`, `service update --force`, `30180`
