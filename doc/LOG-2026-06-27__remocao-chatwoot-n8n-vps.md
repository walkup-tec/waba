# LOG — Remoção Chatwoot + n8n (srv1261237)

## Pedido

Excluir por completo Chatwoot e n8n do VPS para reduzir CPU (Easypanel ~35%, sidekiq/puma/n8n).

## WABA

Sem dependência runtime — `_n8n_link_nonce` é parâmetro interno do encurtador; aquecedor/disparos nativos.

## Serviços removidos (SSH)

```bash
docker service rm walkup_chatwoot-sidekiq walkup_chatwoot-walkup \
  walkup_chatwoot-redis-walkup walkup_chatwoot-db-walkup walkup_n8n
```

## Validação pós-remoção

- `grep chatwoot|n8n` → nenhum serviço
- `https://waba.draxsistemas.com.br/health` → **200**
- CPU: Traefik ~0,8%; sem sidekiq/puma/n8n

## Pendente (Etapa 5)

- Easypanel UI: apagar serviços fantasma no projeto **walkup** (se ainda listados)

## Etapa 7 — Volumes removidos (11)

`digital-corban_*`, `soma_*`, `walkup_chatwoot*`, `walkup_n8n_data` — disco liberado.

Palavras-chave: `chatwoot-removido`, `n8n-removido`, `walkup_n8n`, `cpu-vps`
