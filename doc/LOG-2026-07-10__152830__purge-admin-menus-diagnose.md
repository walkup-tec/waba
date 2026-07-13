# LOG - Diagnose purge admin menus production failure

**Data:** 2026-07-10 ~15:27 (America/Sao_Paulo)
**Pedido:** Diagnosticar falha do purge Admin em producao; health catalog; bugs de schema; bloco docker exec.

## Health (https://waba.draxsistemas.com.br/health)

- containerService: `waba_disparador`
- dataDir: `/app/data`
- wabaEnv: production
- deployMarker: DEPLOY-2026-07-10-chamados-todos-usuarios

| id | file | exists | sizeBytes | updatedAt |
|----|------|--------|-----------|-----------|
| campaignIntakes | waba-campaign-intakes.json | true | 86151 | 2026-07-09T17:52:52.978Z |
| supportTickets | waba-support-tickets.json | true | 9754 | 2026-07-10T16:18:00.189Z |
| pushMessages | waba-push-messages.json | true | 36969 | 2026-07-09T17:58:38.861Z |
| financeiroSettlements | waba-financeiro-split-settlements.json | true | 17618 | 2026-07-09T17:52:52.974Z |
| financeiroSplit (KEEP) | waba-financeiro-split-config.json | true | 1211 | 2026-07-09T02:36:17.966Z |
| billingOrders (KEEP) | waba-billing-orders.json | true | 7780 | 2026-07-09T14:54:40.476Z |
| disparosLocal | disparos-local-state.json | true | 93 | 2026-07-10T18:26:13.965Z |

Conclusao: purge **nao foi aplicado** em producao (intakes/tickets/push/settlements ainda grandes). Falha operacional anterior = SSH sem chave (LOG 121728).

## Schema empty vs repos

| Arquivo | Script EMPTY | Repo | Match |
|---------|--------------|------|-------|
| waba-campaign-intakes.json | {version:1,intakes:[]} | emptyStore() | OK |
| waba-support-tickets.json | {version:1,tickets:[]} | emptyStore() | OK |
| waba-push-messages.json | {version:1,messages:[]} | emptyStore() | OK |
| waba-financeiro-split-settlements.json | {version:1,settlements:[]} | readStore fallback | OK |
| disparos-local-state.json | {version:1,savedAt,campaigns:[],leads:[]} | queuePersist / loadDisparosLocalState | OK |
| waba-master-menu-seen.json | {version:1,masters:{}} | FILE_NAME no badges repo | OK (nome real) |

## Bugs / armadilhas (nao schema empty)

1. **Purge nunca rodou no VPS** (SSH Permission denied) — causa raiz do "failed".
2. **Supabase no script**: `dotenv` carrega `path.join(__dirname,'..','.env')`. Se o script estiver em `/tmp/`, nao acha `.env`; no container as vars ja existem em `process.env` — OK se nao depender do arquivo. Se `@supabase/supabase-js` nao estiver no PATH do node do container a partir de /tmp, `require` pode falhar (resolve a partir de cwd/node_modules do app — melhor `cd /app`).
3. **Catalog health** lista `waba-admin-master-menu-badges.json` (inexistente) mas o app usa `waba-master-menu-seen.json` — so cosmetico no /health.
4. **Memoria do processo**: apos wipe de arquivos, reiniciar container ou o app pode regravar `disparos-local-state` a partir da memoria / Supabase no checkpoint.
5. **Nao e bug de empty JSON** nos stores pedidos.

## Keywords

purge-admin-menus, health catalog, docker exec waba_disparador, empty schema, SSH blocked
