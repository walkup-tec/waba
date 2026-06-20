# LOG — cache rápido listagem instâncias V02

**Data:** 2026-06-20

## Problema
Listagem de instâncias demorava ~12–70s (timeout Evolution) ao abrir menu Instâncias.

## Solução (3 camadas)
1. **localStorage** (`waba.instances.cache.v1.{email}`) — exibe imediato ao abrir aba
2. **`GET /instancias/snapshot`** — cache servidor (instance-owners + evo-instances-cache.json), ~ms
3. **`GET /instancias?refresh=1`** — refresh Evolution em background (45s max), botão Atualizar

## Comportamento
- Menu Instâncias → `loadInstancesForInstanciasTab()`: local → snapshot → background refresh (45s cooldown)
- Polling `carregar()` usa snapshot, não bloqueia na EVO
- Botão **Atualizar** força refresh completo

## Arquivos
- `src/index.ts` — snapshot route, `/instancias` default = snapshot
- `index.html` — cache local + loadInstancesForInstanciasTab
