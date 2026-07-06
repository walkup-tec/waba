# LOG — Aquecedor paywall falso em deploy/restart

**Data:** 2026-06-24  
**Contexto:** Usuário `mozart.pmo@gmail.com` (com créditos) via overlay «Contrate um disparo…» na aba Aquecedor durante trabalho no código ou deploy — comportamento indevido.

## Causa raiz

1. **Frontend:** `loadAquecedorEntitlement()` em falha de rede/502 (servidor reiniciando) gravava `active: false` e exibia o gate imediatamente.
2. **Race:** `applyMenuSectionAccess()` rodava antes do entitlement carregar; cache em memória começava `null` → `hasAquecedorAccess()` falso.
3. **Backend:** entitlement considerava só pedido PIX pago nos últimos 30 dias, ignorando saldo de créditos já contratados.

## Solução

### Backend (`src/entitlements/waba-entitlement.service.ts`)
- `buildActiveFromCredits()` — libera Aquecedor se `hasCredits`, `pendingBonusShipments` ou `contractedShipments` > 0.
- Fallback de créditos quando não há pagamento recente ou janela de 30 dias expirou.

### Frontend (`index.html`)
- Cache em `sessionStorage` por e-mail (`waba.aquecedor.entitlement.v1.*`).
- `aquecedorEntitlementLoading` — não bloqueia UI enquanto verifica.
- `resolveAquecedorEntitlementFallback()` — em erro HTTP/rede, mantém último entitlement válido ou usa `disparosCreditsCache.hasCredits`.
- `hasAquecedorAccess()` — fallbacks: créditos, loading, sessionStorage.
- Hidratação no login + refresh em `window.focus`.
- `loadDisparosCredits()` chama `syncAquecedorSectionVisual()` após saldo.

### Deploy marker
- `DEPLOY-2026-06-24-aquecedor-entitlement-resilience`

## Arquivos alterados
- `src/entitlements/waba-entitlement.service.ts`
- `index.html` (+ `dist/index.html` via build)
- `src/deploy-marker.ts`

## Como validar
1. Login como assinante com créditos → aba Aquecedor sem overlay.
2. Com aba aberta, reiniciar container/servidor → durante ~segundos não deve aparecer paywall; após API voltar, entitlement confirma.
3. `GET /entitlements/aquecedor` com usuário só com créditos (sem PIX recente) → `active: true`.
4. `GET /health` → marker `DEPLOY-2026-06-24-aquecedor-entitlement-resilience`.

## Palavras-chave
`aquecedor`, `entitlement`, `paywall`, `sessionStorage`, `disparos credits`, `deploy resilience`, `runtime-intent`

## Pendências
- Commit + push com `dist/` e redeploy Easypanel (não solicitado nesta sessão).
