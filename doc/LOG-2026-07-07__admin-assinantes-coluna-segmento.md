# LOG — 2026-07-07 — Admin Assinantes: coluna Segmento (full chain)

## Solicitação
Adicionar coluna **Segmento** na tabela "Assinantes cadastrados" (Admin · Assinantes)
para exibir de qual segmento é cada assinante (Bets | Outros).

## Contexto
- `src/subscribers/waba-subscriber-segment.ts` existia (untracked) mas estava **órfão**:
  nenhum código de produção o importava; `subscriber.segment` nunca era persistido.
- Sem source-of-truth, a coluna sempre mostraria "Outros". Implementado o chain completo.

## Alterações

### Backend
- `src/subscribers/waba-subscriber.repository.ts`
  - `WabaSubscriber` ganhou `segment?: "bets" | "outros"` (evita import circular).
- `src/subscribers/waba-subscriber.service.ts`
  - Importa `parseWabaSubscriberSegment` / `WabaSubscriberSegment`.
  - `RegisterSubscriberInput` e `UpdateSubscriberInput` ganharam `segment?`.
  - `register()` persiste segment (default "outros") e retorna no profile.
  - `update()` grava segment quando enviado (fallback = valor atual).
- `src/subscribers/waba-subscriber.routes.ts`
  - Signup público resolve segment por `resolveSignupSegmentFromRequest(body, {origin, referer})`.
- `src/admin/waba-admin-subscribers-create.service.ts`
  - `AdminCreateSubscriberInput.segment?` + repassa via `parseWabaSubscriberSegment`.
- `src/admin/waba-admin-subscribers.service.ts`
  - `AdminSubscriberListItem` e `detail.profile` expõem `segment` + `segmentLabel`.
- `src/admin/waba-admin.routes.ts`
  - POST `/admin/subscribers` e PATCH `/admin/subscribers/:id` capturam `segment`.

### Frontend (`index.html` + `dist/index.html` via build)
- Novo `<th>Segmento</th>` na tabela; colspans 8 → 9 (loading/empty).
- `renderAdminSubscriberSegmentBadge()` + `normalizeAdminSubscriberSegment()` (badge Bets/Outros).
- CSS `.admin-subscriber-segment-badge.is-bets` (verde) / `.is-outros` (azul).
- Select **Segmento** no form de criar assinante (`#admin-subscriber-segment`) e no
  modal de edição (`#admin-subscriber-detail-segment`), com wiring no POST/PATCH e reset.

## Regra de origem (default)
- `bet.waba.info` → **bets**
- `wabadisparos.com.br` → **outros**
- Master pode ajustar manualmente via criar/editar.

## Validação
- `npx tsc --noEmit` → exit 0.
- `npm run build` (tsc + copy-index-html) → exit 0; `dist/index.html` atualizado.
- Assinantes existentes (ex.: "Assinante Bet") aparecem como **Outros** até o master
  editar o segmento (não havia persistência anterior).

## Pendências / retomada
- Testar em `http://localhost:3012/version-02/` (Admin · Assinantes) o badge e o edit.
- Opcional: integrar signup real do bet.waba.info (betwaba-connect) enviando
  `segment: "bets"` no POST `/subscribers/register`.
- Não commitado ainda (aguardando validação do usuário).
