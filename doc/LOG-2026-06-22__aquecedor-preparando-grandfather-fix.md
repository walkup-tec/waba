# LOG — Fix Preparando: instância 5182008906 (atendimento-906)

**Data:** 2026-06-22

## Contexto

Instância **5182008906** (`atendimento-906`, número `555182008906`) deveria aparecer como **Preparando** na UI, mas mostrava **conectado**.

## Integração (EVO cache)

| Campo | Valor |
|-------|--------|
| Nome EVO | `atendimento-906` |
| Número | `555182008906` |
| `createdAt` (UTC) | `2026-06-22T17:50:54.322Z` |
| Horário Brasília | **22/06/2026 ~14:50** |

Menos de 12h desde a integração → ainda em fase **Preparando** (promoção estimada ~23/06 ~02:50 BRT + fila).

## Causa raiz

1. **`ensureAquecedorInstanceRegistered`** retornava cedo se já existia linha em `instancias_uso_config` (Supabase) — não chamava `registerAquecedorInstancePreparing`.
2. **`filterAquecedorCycleConnected`** fazia **grandfather** (`active`) para qualquer instância sem row no lifecycle — inclusive integrações novas do dia 22/06.

## Correção

### `aquecedor-instance-lifecycle.service.ts`

- Cutoff legado: `AQUECEDOR_LIFECYCLE_GRANDFATHER_CUTOFF_ISO = 2026-06-22T00:00:00.000Z`
- Lê `createdAt` de `evo-instances-cache.json`
- Instâncias **antes** do cutoff → `grandfather` ativo; **a partir** do cutoff → `preparing` com `preparingSince = createdAt`
- **`reconcileGrandfatheredActiveRow`**: reverte `active` indevido para `preparing` se integrada após cutoff e ainda dentro das 12h
- `registerAquecedorInstancePreparing(name, preparingSince?)` aceita data da integração

### `index.ts`

- `ensureAquecedorInstanceRegistered`: sempre garante lifecycle após uso-config
- `GET /instancias/uso-config`: reconcilia lifecycle de todas instâncias com aquecedor ON antes de montar labels

## Validar

1. Login mozart V02 → aba Instâncias → `atendimento-906` (5182008906) → Status **Preparando** + contador regressivo (branch v02).
2. Instâncias antigas (`walkup`, `soma`, `drax`) continuam **conectado** (sem Preparando).

## Palavras-chave

`5182008906`, `atendimento-906`, `preparando`, `grandfather`, `aquecedor-instance-lifecycle`, `createdAt`, `uso-config`
