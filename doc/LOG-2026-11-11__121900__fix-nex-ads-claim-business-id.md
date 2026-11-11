# LOG — Nex Ads: conexão “OK” sem número (claim sem BM)

## Contexto
Após ES, banner **Conexão concluída com sucesso**, card Nex Ads `…7910` ainda com **WABA —** e **0 números** (`+55 51 92636-4461` Pendente na Meta).

## Causa (evidência)
1. `metaTpHasListedNumbers()` considera **qualquer** portfólio — Drax/Walkup já tinham chips → falso sucesso.
2. O **+** gravava só `savedBusinessId`; `/complete` enviava `metaTpSession.businessId` (vazio se a Meta não mandasse `business_id` no postMessage) → claim sem BM Nex Ads.
3. Sem `waba_id` no postMessage, o front **nem chamava** `/complete` com o BM focado.

## Solução
1. Front: `businessId`/`wabaId` do setup no session; claim com `savedBusinessId` fallback; complete mesmo só com BM.
2. Front: sucesso do fluxo `addNumber` exige WABA/número **do BM focado** (`metaTpFocusedPortfolioReady`).
3. Backend `attachSessionAssets`: com BM e sem WABA/phone, descobre `owned`/`client` + primeiro `phone_numbers` na Graph.

## Marker
`DEPLOY-2026-11-11-nex-ads-claim-business-id`

## Validação
- `node --test … phase3` — complete só com BM Nex Ads
- `meta-es-fb-login` — HTML claimBusinessId / focusedReady
- Produção: redeploy → Nex Ads → **+** → ES → card com WABA e 4461 (PIN)

## Palavras-chave
Nex Ads, 7910, 4461, claimBusinessId, attachSessionAssets, metaTpFocusedPortfolioReady, falso sucesso
