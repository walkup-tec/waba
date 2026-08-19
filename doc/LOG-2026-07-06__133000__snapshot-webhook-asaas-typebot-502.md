# LOG — 2026-07-06 13:30 — snapshot webhook Asaas typebot 502

## Solicitação
Correção produção: fila webhook Asaas **typebot** pausada (502 em app.chattypebot.com/api/webhooks/asaas).

## Ação
- Diagnóstico: 502 = Traefik/API Typebot (não handler).
- Scripts atualizados em `D:\typebot-Saas\scripts\`:
  - `traefik-permanent-vps.sh` (restart se app=502 + teste webhook)
  - `fix-typebot-asaas-webhook-vps.sh` (novo)
- Doc: `D:\Waba\doc\LOG-2026-07-06__fix-asaas-webhook-typebot-502-producao.md`

## Pendência produção (SSH usuário)
1. Rodar script no VPS
2. Reativar fila no Asaas
3. Validar token ASAAS_WEBHOOK_ACCESS_TOKEN no Easypanel api
4. Push scripts typebot-Saas para GitHub (ainda não commitado)
