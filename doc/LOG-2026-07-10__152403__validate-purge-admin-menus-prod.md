# LOG — 2026-07-10 — Validação purge Admin menus (produção)

## Contexto

Usuário rodou purge via SSH. Pedido: validar via `/health` dataPersistence catalog.

## Comando

`Invoke-RestMethod https://waba.draxsistemas.com.br/health`

- ok: true
- deployMarker: `DEPLOY-2026-07-10-chamados-todos-usuarios`
- dataDir: `/app/data` (writable)
- fileCount: 38

## Catalog (alvos)

| id | sizeBytes | updatedAt | Esperado pós-purge | Status |
|----|-----------|-----------|--------------------|--------|
| campaignIntakes | 86151 | 2026-07-09T17:52:52Z | vazio / ~mínimo | **NÃO limpo** |
| supportTickets | 9754 | 2026-07-10T16:18:00Z | vazio | **NÃO limpo** (ou recriado) |
| pushMessages | 36969 | 2026-07-09T17:58:38Z | vazio | **NÃO limpo** |
| financeiroSettlements | 17618 | 2026-07-09T17:52:52Z | vazio | **NÃO limpo** |
| financeiroSplit | 1211 | 2026-07-09T02:36:17Z | preservar | OK preservado |
| billingOrders | 7780 | 2026-07-09T14:54:40Z | preservar | OK preservado |
| disparosLocal | 93 | 2026-07-10T18:22:53Z | vazio | **Parece limpo** |

## Endpoints públicos de lista

APIs admin (`/api/support/tickets`, campaign-intakes, push, billing, settlements, disparos/local) → **401** sem auth. Sem lista pública de empty-state; `/health` catalog é o sinal público.

## Restart

**Não necessário** para “ver” purge: volume `/app/data`. Problema atual = dados ainda grandes no disco, não cache de container.

## Veredito

Purge **não aplicado de forma completa** (ou dry-run / data-dir errado / só disparosLocal). Reexecutar no VPS:

`node scripts/purge-admin-menus-production.cjs --data-dir /app/data --apply`

(opcional `--with-supabase`) e rechecar `/health`.

## Palavras-chave

`validate purge`, `dataPersistence catalog`, `admin menus`, `sizeBytes`
