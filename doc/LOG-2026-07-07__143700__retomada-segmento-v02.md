# LOG — 2026-07-07 14:37 — Retomada segmento V02 (snapshot de recuperação)

## Contexto / chats abertos
- Sessão anterior encerrou sem snapshot final. Recuperação feita a partir do estado do repo e LOGs de 06/07.
- Pedido atual: "continue de onde paramos no projeto waba".

## Estado ao retomar
- Branch: `v02` (HEAD `bd7307f`), 0 atrás / N à frente de `origin/master`.
- Regra ativa (2026-07-06): desenvolver no V02 primeiro; produção só com autorização explícita.
- `npx tsc --noEmit`: **OK** (exit 0, sem erros).

## Trabalho em andamento (não commitado) — feature Segmento
Feature: segmento `Bets` × `Outros` para assinante e operacional + tarifador Bet.

- **`src/subscribers/waba-subscriber-segment.ts` (novo):** tipo `WabaSubscriberSegment` (`bets`|`outros`), parser, `resolveSignupSegmentFromRequest` (origem `bet.waba.info`→bets, `wabadisparos.com.br`→outros), helpers `getSubscriberSegmentByEmail`/`isBetsSubscriberEmail`.
- **`src/subscribers/waba-subscriber.service.ts`:** `register()` resolve segmento (input ou origem); `toPublicProfile()` expõe `segment`/`segmentLabel`; migração legada `segment→outros`.
- **`src/subscribers/waba-subscriber.repository.ts` / `routes.ts`:** persiste `segment`; rota `/subscribers/register` repassa `segment`/`signupOrigin` + headers `origin/referer`.
- **`src/billing/waba-billing.service.ts`:** tabela `DISPAROS_BETS_OFICIAL_SALE_PACKAGES`; Bets bloqueado em API Alternativa (checkout e créditos); tarifação custom por segmento.
- **`src/billing/waba-billing.routes.ts`:** repassa `ownerEmail` para tarifação por segmento.
- **`src/disparos/waba-campaign-intake.routes.ts`:** Bets só gera campanha API Oficial.
- **`src/admin/waba-operacional-campanhas.service.ts` + `src/mail/waba-operacional-campaign-notify.service.ts`:** campanha visível/notificada ao operacional só quando `apiKind`=`operacionalDispatchesApi` E `segment`=`operacionalSegment` (master/suporte veem todas).
- **`src/users/waba-system-user.*`:** segmento operacional `Todos`→`Outros` (alias legado `todos`→`outros`).
- **`index.html`, `public-pages/cadastro.html`, `public-pages/vendas.html`:** UI de segmento (criar/editar usuário e assinante) + hint Campanhas operacional.

## Comandos executados
```powershell
git status --short
git fetch origin
git rev-list --left-right --count origin/master...HEAD
npx tsc --noEmit   # OK
git diff --stat
```

## Validação
- Typecheck OK. Teste funcional pendente via `npm run dev:v02` (http://localhost:3012/version-02/).

## Pendências para retomada
1. Teste funcional V02: cadastro Bets/Outros, tarifador Bet, campanha Bets (só Oficial), filtro operacional por segmento.
2. Integração real signup `bet.waba.info` (hoje mock) — POST `/subscribers/register` com `signupOrigin: "bet-waba"` (tarefa de produção).
3. Produção: só quando autorizado — merge `v02`→`master` + build `dist/` + deploy Easypanel.

## Segurança
- Sem segredos expostos. Sem alteração em `master`/produção. `/app/data` não tocado.

## Palavras-chave
`waba-subscriber-segment`, `segmento bets outros`, `tarifador bet`, `operacionalSegment`, `resolveSignupSegmentFromRequest`, `v02`.
