# LOG — 2026-07-07 16:20 — Fix segmento Bet + Aquecedor + Alternativa (V02)

## Contexto
Assinante `digitalcorban@gmail.com` criado como Bet no admin V02:
- Segmento não persistiu (voltou Outros)
- Acessou Aquecedor sem checkbox "Liberar Aquecedor"
- Acessou recursos API Alternativa (proibido para Bets)

## Causas raiz
1. **Backend:** feature de `segment` em `waba-subscriber.*` havia sido **revertida** em commits posteriores (monitor/uptime); repositório não gravava `segment`.
2. **Front:** `hasAquecedorSectionMenuAccess()` retornava `true` para **todo assinante** (`if (!isStaffRole) return true`).
3. **Front:** `hasAquecedorAccess()` liberava durante loading e com cache de créditos de outra sessão.
4. **Front:** botão API Alternativa não checava `isBetsSubscriberAccount()`.
5. **Dado:** `digitalcorban@gmail.com` criado sem campo `segment` no JSON.

## Correções
- Restaurados de `6c0dfac`: `waba-subscriber-segment.ts`, repository, service, routes, billing, campaign-intake, admin routes, operacional notify, system-user segment.
- `index.html`: Aquecedor só com entitlement; Alternativa oculta para Bets; limpar caches ao trocar sessão; `normalizeIntegrationEnv`/`selectDisparosApiKind` bloqueiam alternativa para Bets.
- `admin-subscribers-create`: `adminCreate: true` força parse obrigatório do segmento.
- Dado V02: `digitalcorban@gmail.com` → `"segment": "bets"`.

## Validar no V02
1. Reiniciar `npm run dev:v02` (ts-node não hot-reload).
2. Admin → editar digitalcorban → segmento Bets persistido.
3. Login como digitalcorban → sem Aquecedor (sem compra/checkbox); sem API Alternativa.
4. Criar novo assinante Bet → segmento persiste na lista e no modal.

## Palavras-chave
`segment`, `bets`, `aquecedorGranted`, `hasAquecedorSectionMenuAccess`, `isBetsSubscriberAccount`, `digitalcorban`
