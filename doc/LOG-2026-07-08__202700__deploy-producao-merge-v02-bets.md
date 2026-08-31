# Deploy produção — merge V02 → master (2026-07-08)

## Commits

- `ff8115a` (v02): `[828ccc8] feat: V02 Bets paridade - tarifador, landing cadastro, boas-vindas equipe e UI`
- `966b274` (master): merge v02 → master

## Marker

`DEPLOY-2026-07-08-bets-v02-paridade-landing-cadastro`

## Principais entregas

- Bets: tarifador 5k–50k, `creditBet_02.png`, oculta API Alternativa, card preços
- Landing `public-pages/bets.html` + fix cadastro telefone/WhatsApp (`cadastro.html`, `phone.ts`)
- Boas-vindas automática operacional/suporte (e-mail + WhatsApp)
- Admin: marcar/desmarcar tudo menus; reenvio boas-vindas sem senha
- Monitor CPU/uptime parity, welcome WhatsApp resiliente, aquecedor gate

## Ação usuário

Redeploy **waba_disparador** no Easypanel + validar `GET /health` marker.

## GitHub Actions

Deploy FTP (bundle) disparado no push `master`.
