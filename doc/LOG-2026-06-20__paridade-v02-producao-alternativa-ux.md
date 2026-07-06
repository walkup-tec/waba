# LOG — Paridade V02 + Produção (alternativa UX)

**Data:** 2026-06-20

## Pacote incluído
- Informe Meta / compra números (UX)
- Fuso horário fila aquecedor
- Etapas disparos EVO (auto-abrir próxima visível)
- Projeção campanha só após informar qty envios
- Regras dispatch alternativa (min 4 compra, 3 ativos, 300/dia)

## Git
- **master** `513988b` → push `origin/master` (produção `waba_disparador`)
- **v02** `e0f8dce` merge master → push `origin/v02` (serviço `waba_disparador_v02` se existir no Easypanel)

## Marker
`DEPLOY-2026-06-20-alternativa-ux-paridade-v02-prod`

## Deploy produção
Easypanel → serviço **waba_disparador** → branch **master** → redeploy.

Validar: `GET /health` → `deployMarker`.

## V02 local
`npm run dev:v02` → http://localhost:3012/version-02/
