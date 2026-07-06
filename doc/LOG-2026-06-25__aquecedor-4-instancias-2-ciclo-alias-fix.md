# LOG — Aquecedor: 4 conectadas, só 2 no ciclo

**Data:** 2026-06-25  
**Marker:** `DEPLOY-2026-06-25-aquecedor-lifecycle-alias-cycle-fix`

## Contexto

Usuário reportou: 4 instâncias ativas/conectadas com Aquecedor ON, mas envios alternando apenas entre `walkup` e `soma`. UI mostrava todas como **conectado** (sem **Preparando**).

## Causa raiz

1. **Modo seguro (lifecycle):** instâncias integradas após `2026-06-22` ficam **6h em Preparando** antes de entrar no ciclo. O motor roda com as que já estão `active` (ex.: walkup + soma legadas).
2. **Alias / nome técnico:** lifecycle gravado sob um nome (uso-config) e o ciclo resolvia sob outro (EVO), criando linhas duplicadas — UI via `active` (conectado) e filtro do ciclo via `preparing` (excluída).
3. **Visibilidade:** quando ≥2 ativas, o motor não informava quantas ficaram de fora por preparação.

## Correção

### `aquecedor-instance-lifecycle.service.ts`

- Resolução de lifecycle por **alias** (`instance-aliases.json`): `findAquecedorLifecycleRow`, `collectInstanceNameKeys`.
- `readEvoInstanceCreatedAt` busca `createdAt` por alias.
- `filterAquecedorCycleConnected`, `registerAquecedorInstancePreparing`, `canAquecedorInstanceSendToday` usam lookup unificado.

### `index.ts`

- Antes do filtro do ciclo: `registerAquecedorInstancePreparing` para **todas** as conectadas (nomes EVO).
- `syncAquecedorConnectedInstances` com `connectedAll` (não só as ativas).
- Status: `preparingInstanceCount`, `preparingInstances`, `totalAquecedorEnabledCount`.
- `lastResult` após envio menciona instâncias em preparação.
- `GET /instancias/uso-config`: fallback `getAquecedorLifecycleStatusForInstance` (alias-aware).

### `index.html`

- Hero: `2 no ciclo · 2 preparando (4 total)` quando aplicável.

## Validar

1. Deploy + marker em `/health`.
2. Aba Instâncias: instâncias novas devem mostrar **Preparando** + countdown (não só conectado).
3. Aquecedor ativo: contador `N no ciclo · M preparando`.
4. Após 6h desde integração (ou countdown zerado), as 4 entram no ciclo (12 combinações direcionadas).

## Palavras-chave

`aquecedor`, `preparando`, `lifecycle`, `alias`, `walkup`, `soma`, `4 instâncias`, `2 ciclo`, `filterAquecedorCycleConnected`
