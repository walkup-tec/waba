# LOG — Evolution P1001: PostgreSQL inacessível (`walkup_evo-walkup-api-db`)

## Sintoma (Easypanel — `walkup/evo-walkup-api`)

```
Error: P1001: Can't reach database server at `walkup_evo-walkup-api-db:5432`
Migration failed
```

Evolution **2.3.7** não sobe: `prisma migrate deploy` falha antes da API responder. Impacto direto: HTTP 500 no `sendText`, aquecedor pendente, operacional/boas-vindas.

## Causa

O container da Evolution não alcança o PostgreSQL interno do stack Easypanel (`walkup_evo-walkup-api-db`). Não é bug do WABA — é **infra Easypanel/Docker Swarm**:

1. Serviço **PostgreSQL** parado, crashando ou `0/1`
2. DB ainda subindo quando a Evolution tenta migrate (menos comum após vários retries)
3. Serviço DB **removido/renomeado** no painel
4. Rede overlay quebrada após restart Docker/Swarm (raro)

## Correção (ordem obrigatória)

### No Easypanel (projeto **walkup**)

1. Abrir serviço **`evo-walkup-api-db`** (PostgreSQL) → status **Running** / verde
2. Se parado: **Start** → aguardar ~30–60s
3. Se falha ao iniciar: ver **Logs** (disco cheio, corrupt data, senha)
4. Só então **Restart** em **`evo-walkup-api`**
5. Confirmar logs sem `P1001` e API em `http://127.0.0.1:30181/instance/fetchInstances` → 200

### No VPS (SSH root)

```bash
# Copiar do repo:
# scp E:\Waba\scripts\infra\diagnose-evo-postgres-vps.sh root@72.60.51.127:/root/

bash /root/diagnose-evo-postgres-vps.sh

# Se DB 1/1 mas EVO ainda falha:
docker service update --force walkup_evo-walkup-api-db
sleep 25
docker service update --force walkup_evo-walkup-api
```

### Se o serviço DB não existir mais

- Easypanel → recriar banco PostgreSQL do app Evolution **com o mesmo volume** (não apagar volume sem backup)
- Restaurar backup do volume Postgres se houver
- **Não** apagar volumes Evolution sem snapshot — perde instâncias/sessões WhatsApp

## Caso real 2026-07-09 — overlay Swarm quebrado (srv1261237)

Sintomas:
- `walkup_evo-walkup-api-db` **1/1**, `pg_isready` OK **dentro** do container
- Evolution **P1001** crash loop no migrate
- `nc walkup_evo-walkup-api-db 5432` → **`Host is unreachable`** (IP overlay ex. `10.11.0.19`)
- Env `DATABASE_CONNECTION_URI` correto; DB e EVO nas **mesmas** redes overlay (`docker service inspect`)

Causa: roteamento da **rede overlay Docker Swarm** corrompido (histórico `Address already in use` no DB). Não é senha nem Postgres parado.

### Correção (tentar nesta ordem)

```bash
# 1) Rede overlay do stack (não usar rede "easypanel" no teste)
docker network inspect c5l9t0rirt5sqkk8in7fl599h --format '{{.Name}}'
NET=$(docker network inspect c5l9t0rirt5sqkk8in7fl599h --format '{{.Name}}')
docker run --rm --network "$NET" alpine sh -c "nc -zv walkup_evo-walkup-api-db 5432"

# 2) Recriar tasks (DB primeiro)
docker service update --force walkup_evo-walkup-api-db
sleep 40
docker service update --force walkup_evo-walkup-api-redis
sleep 15
docker service update --force walkup_evo-walkup-api
sleep 30
curl -sS -o /dev/null -w "fetchInstances: %{http_code}\n" http://127.0.0.1:30181/instance/fetchInstances
```

Se `nc` ainda der unreachable → **janela de manutenção**:

```bash
systemctl restart docker
sleep 60
docker service ls | grep walkup
```

Depois validar `nc` na rede `$NET` e curl `:30181`.

Alternativa Easypanel: **Stop** `evo-walkup-api` → **Restart** `evo-walkup-api-db` → aguardar → **Start** Evolution.


## Após DB voltar

1. WABA já tem recovery de send (`DEPLOY-2026-07-09-evo-send-recovery-failover`) — mensagens pendentes devem retomar
2. Validar: `GET /service/evo-integration-probe` ou `curl http://127.0.0.1:30181/instance/fetchInstances`
3. Se instâncias `open` mas send falha: restart leve por instância ou QR reconectar

## Palavras-chave

`P1001`, `walkup_evo-walkup-api-db`, `prisma migrate deploy`, `evo-walkup-api`, `PostgreSQL Easypanel`, `HTTP 500 sendText`
