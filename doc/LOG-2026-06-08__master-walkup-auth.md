# LOG — master walkup@walkuptec.com.br

**Data:** 2026-06-08

## Pedido
Configurar acesso master para `walkup@walkuptec.com.br`.

## Estado local (v02)
- `.env.v02` já contém `WABA_ADMIN_EMAIL=walkup@walkuptec.com.br` + senha + `WABA_SESSION_SECRET`
- Teste `POST /version-02/auth/login` → `role: master` OK
- `GET /auth/session` → `authenticated: true`, `role: master`

## Master no sistema
- Único e-mail master = valor de `WABA_ADMIN_EMAIL` no servidor
- Área admin (Dashboard, Assinantes, Financeiro) liberada com `role: master`
- Aquecedor/disparos sem bloqueio de entitlement

## Produção (pendente se ainda não feito)
No Easypanel, serviço `waba_disparador`:
- `WABA_ADMIN_EMAIL=walkup@walkuptec.com.br`
- `WABA_ADMIN_PASSWORD=` (senha forte, não commitar)
- `WABA_SESSION_SECRET=` (≥16 chars, único por ambiente)
- `WABA_SESSION_COOKIE_SECURE=true` (HTTPS)
- Redeploy após salvar

## Próximo passo
Confirmar se o alvo é só local ou também produção Easypanel.
