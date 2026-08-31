# LOG — Desconectar todas instâncias EVO (logout em massa falhou)

**Data:** 2026-07-01  
**Pedido:** Desconectar todas instâncias conectadas (master + assinantes) para liberar QRCode/Atualizar no painel.

## Ações executadas

1. `node scripts/disconnect-all-evo-instances.cjs` contra `https://walkup-evo-walkup-api.achpyp.easypanel.host`
2. Tentativa `POST /instance/restart/{name}` em 6 instâncias
3. Tentativas alternativas de logout (`DELETE/POST /instance/logout`, etc.) em `walkup`

## Resultado

| Instância | fetchInstances | connectionState | logout | restart |
|-----------|----------------|-----------------|--------|---------|
| 7943 | open | open | HTTP 500 Connection Closed | 200 (permanece open) |
| soma | open | open | HTTP 500 | 200 (open) |
| digital-corban-2477 | open | open | HTTP 500 | — |
| walkup | open | open | HTTP 500 | 200 (open) |
| final-1267 | open | open | HTTP 500 | 200 (open) |
| drax-oficial | open | open | HTTP 500 | 200 (open) |

**Conclusão:** a Evolution está com sessões Baileys presas (`Connection Closed` no logout). Não é possível desconectar remotamente só pela API.

## O que o usuário precisa fazer (infra)

1. **Easypanel** → projeto **walkup** → serviço **`evo-walkup-api`** (ou Swarm `walkup_evo-walkup-api`) → **Restart**
2. Aguardar ~60s
3. Atualizar o painel WABA (F5)
4. Instâncias devem aparecer **desconectadas** → botões **Atualizar** e **QRCode** habilitados
5. Reconectar QR uma a uma

Alternativa no VPS (SSH root):

```bash
docker service update --force walkup_evo-walkup-api
# ou restart pelo painel Easypanel
```

## Validação pós-restart

```bash
node scripts/disconnect-all-evo-instances.cjs --dry-run
# deve listar 0 instâncias a desconectar

node scripts/run-evo-integration-probe.cjs
# após npm run build — liveOpenCount coerente
```

## Observações

- WABA produção (`waba.draxsistemas.com.br`) ainda no marker `DEPLOY-2026-06-21-exclusao-instancia-tombstone-fix`; UI desabilita QR quando `connectionStatus=open` (cache fetchInstances).
- Instância `6841` foi deletada em tentativa anterior (mozart) — não consta mais na lista atual (6 instâncias).

## Palavras-chave

`desconectar-instancias`, `logout-evo`, `connection-closed`, `restart-evolution`, `qrcode-bloqueado`, `easypanel-evo-walkup-api`
