# LOG — E-mail erro abre lista + borda card campanha

**Data:** 2026-06-18

## Pedido
- Link do e-mail de erro não deve abrir modal; só a tela de campanhas.
- Card com erro: contorno vermelho.
- Campanha finalizada com sucesso: contorno verde.

## Alterações
- `waba-mail-delivery.ts` / `waba-mail.templates.ts`: botão «Ver minhas campanhas» → `?aba=disparos`
- `waba-app-url.ts`: `buildCampaignErrorDeepLink` redireciona para lista (links antigos compatíveis)
- `index.html`: `consumeCampanhaErroDeepLink` só abre aba Disparos (sem modal)
- `index.html`: classes `.disparos-campaign-item--error_reported` (vermelho) e `--completed` (verde)

## Marker
`DEPLOY-2026-06-18-waba-email-campanhas-lista-borda`

## Validar
1. Ctrl+F5 → lista Disparos: card erro vermelho, finalizada verde.
2. Link `?campanhaErro=...` legado: abre Disparos sem modal.
3. Novo e-mail: botão abre lista de campanhas.
