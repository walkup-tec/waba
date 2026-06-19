# LOG — Login obrigatório + invalidação de sessões

**Data:** 2026-06-18

## Problema
Produção abria o painel sem login e sem chip do usuário (modo «guest»). Causa: `/auth/session` retornava `authenticated: true` quando `WABA_ADMIN_EMAIL`/`WABA_ADMIN_PASSWORD` não estavam configurados.

## Correção
- `sendSession`: nunca autentica sem token válido; limpa cookie inválido
- `initWabaAuthGate`: só desbloqueia com `authenticated` + e-mail; logout ao rejeitar sessão
- `WABA_SESSION_EPOCH`: tokens antigos invalidados (definir no Easypanel)
- `GET /auth/force-logout`: limpa cookie e redireciona para `/`
- Produção sem auth configurado: APIs retornam 503 (dev mantém bypass)

## Easypanel (obrigatório)
```
WABA_ADMIN_EMAIL=...
WABA_ADMIN_PASSWORD=...
WABA_SESSION_SECRET=... (≥16 chars)
WABA_SESSION_EPOCH=2026-06-18-producao-pack
WABA_SESSION_COOKIE_SECURE=true
```

## Marker
`DEPLOY-2026-06-18-waba-auth-login-obrigatorio`
