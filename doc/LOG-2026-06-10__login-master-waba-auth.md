# Login master WABA

**Data:** 2026-06-10

## Implementação
- Backend: `src/auth/waba-auth.service.ts`, `src/auth/waba-auth.routes.ts`
- Rotas: `GET /auth/session`, `POST /auth/login`, `POST /auth/logout`
- Middleware protege APIs quando `WABA_ADMIN_EMAIL` + `WABA_ADMIN_PASSWORD` estão definidos
- Frontend: tela `#waba-login-screen` + chip usuário / Sair no header
- Credenciais **somente** em `.env` / Easypanel (nunca no código)

## Variáveis
- `WABA_ADMIN_EMAIL`
- `WABA_ADMIN_PASSWORD`
- `WABA_SESSION_SECRET` (recomendado em produção)
- `WABA_SESSION_TTL_HOURS` (default 168)

## Produção
Configurar as variáveis no Easypanel e `WABA_SESSION_COOKIE_SECURE=true` se HTTPS.
