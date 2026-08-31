# LOG — Aquecedor modo seguro (lifecycle)

**Data:** 2026-06-22  
**Marker:** `DEPLOY-2026-06-22-aquecedor-safe-lifecycle`

## Contexto

Números novos conectados na EVO receberam restrição temporária WhatsApp (spam/automação) ao iniciar aquecedor + mesh. Pedido: pausa automática 6h, fila Preparando com liberação a cada 12h, intervalos 5–15 min e teto diário 8–16 msgs/semana 1 com ramp-up.

## Implementação

### Service `aquecedor-instance-lifecycle.service.ts`

| Fase | Comportamento |
|------|----------------|
| `preparing` | Instância nova no aquecedor; não entra no ciclo |
| `active` | Participa do aquecedor |
| `restricted_wait` | 6h após detecção de restrição; status UI "6 horas de espera" |

- Promoção: 1 instância `preparing` → `active` a cada **12h** (após 12h em preparação).
- Limite diário: **8–16** semana 1 (hash estável por instância), +40%/semana (teto 48).
- Persistência: `data/aquecedor-instance-lifecycle.json`

### Aquecedor

- `waitMinSeconds`: 300, `waitMaxSeconds`: 900 (5–15 min aleatório).
- `filterAquecedorCycleConnected` antes do ciclo.
- `shouldSkipAquecedorMeshBootstrap` — mesh completo desligado em modo seguro.
- `detectAndMarkRestrictionFromSend` em falha EVO.
- Probe/inbound com restrição → `markAquecedorInstanceRestricted`.

### UI

- Coluna Status: **Preparando** / **6 horas de espera** via `/instancias/uso-config`.

## Mesh inicial — viável?

**Não para contas novas.** Mesh N×(N−1) dispara "novas conversas" e gera restrição. Modo seguro pula mesh; ciclo bilateral com volume baixo após preparação.

## Validar

1. Conectar 3 instâncias com Aquecedor ON → Status **Preparando**.
2. Após 12h (ou ajustar clock teste) → 1 vira ativa; só 2 no ciclo quando houver 2+ ativas.
3. Simular erro restriction no send → **6 horas de espera**.
4. `/health` → marker safe-lifecycle.
