# LOG — 2026-07-06 12:00 — Operacional segmento × campanhas assinante

## Regra
Operacional mantém **Disparos atendidos** (API Oficial/Alternativa) + **Segmento** (Bets/Outros).

Campanha visível/notificada só quando:
- `apiKind` da campanha = `operacionalDispatchesApi`
- `segment` do assinante = `operacionalSegment`

Master/suporte: veem todas.

## Arquivos
- `src/admin/waba-operacional-campanhas.service.ts`
- `src/mail/waba-operacional-campaign-notify.service.ts`
- `src/users/waba-system-user.service.ts`
- `src/auth/waba-auth.routes.ts`
- `index.html` (hint Campanhas operacional)
