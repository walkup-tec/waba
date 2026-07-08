# LOG — V02 paywall Aquecedor (blur + créditos) = produção

**Data:** 2026-07-08  
**Contexto:** Assinante sem Aquecedor liberado em produção vê overlay com blur e botão para adicionar créditos. No V02 local o mesmo assinante (`mozart.hotmart@gmail.com`) acessava Dashboard/Instâncias sem o bloqueio.

## Causa raiz

1. **`hasAquecedorAccess()`** — após `GET /entitlements/aquecedor` retornar `active: false`, ainda consultava `sessionStorage` antigo (`restoreAquecedorEntitlementCache`) e mantinha acesso liberado se outro login/crédito anterior tivesse gravado cache ativo.
2. **Conta de teste V02** — `mozart.pmo@gmail.com` tem pedidos PIX pagos em `data/v02/waba-billing-orders.json` → entitlement ativo (comportamento correto, sem gate). Para validar paywall usar assinante sem créditos (ex.: `mozart.hotmart@gmail.com`).

## Solução (`index.html`)

- `hasAquecedorAccess()` — prioriza resposta em memória da API; só usa `sessionStorage` antes da primeira resposta.
- `clearAquecedorEntitlementCache()` — limpa cache quando entitlement confirmado inativo; também no logout.
- `syncAquecedorSectionVisual()` — mensagem do gate vinda de `entitlement.message`.
- Botão do gate Aquecedor: **Adicionar créditos** → `goToDisparosAddCredits()` (aba Créditos).
- Gate do dashboard de disparos: botão **Adicionar créditos** (texto alinhado).
- `fetch` de entitlement/credits/logout com `resolveWabaPublicPath()` (V02 `/version-02`).

## Arquivos

- `index.html` (+ `dist/index.html` via `node scripts/copy-index-html.mjs`)

## Como validar (V02)

1. Reiniciar `npm run dev:v02` se necessário; **Ctrl+F5**.
2. Login como `mozart.hotmart@gmail.com` (sem créditos / sem Aquecedor).
3. Abas **Dashboard** ou **Instâncias** (menu Aquecedor) → blur + card + **Adicionar créditos**.
4. Aba **Dashboard** (menu Disparos / API Oficial) → gate de campanhas se `withReport === 0`.
5. Login como `mozart.pmo@gmail.com` → **sem** gate (créditos/PIX de teste no V02).

## Palavras-chave

`aquecedor-section-gate`, `hasAquecedorAccess`, `sessionStorage`, `blur`, `Adicionar créditos`, `v02-parity`, `entitlements/aquecedor`
