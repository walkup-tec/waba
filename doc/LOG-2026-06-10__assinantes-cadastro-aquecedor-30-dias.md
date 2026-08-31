# Assinantes, cadastro PV e Aquecedor 30 dias

**Data:** 2026-06-10

## Fluxo
1. Cadastro gratuito na página de vendas (`pv-waba-disparador`) ou `/cadastro` (fallback teste)
2. Login no painel WABA (assinante ou master)
3. Contratação de disparos + PIX confirmado
4. Aquecedor liberado por **30 dias** desde o último pagamento
5. Sem nova contratação em 30 dias → Aquecedor bloqueado (banner + API 403)

## Backend WABA
- `src/subscribers/` — cadastro JSON `waba-subscribers.json`
- `src/entitlements/waba-entitlement.service.ts` — regra 30 dias via pedidos `paid`
- `POST /subscribers/register`, login assinante em `POST /auth/login`
- `GET /entitlements/aquecedor`
- Guards em `POST /aquecedor/start`, `run-once`, `criar-mensagem-teste`

## URLs de teste (local)
| Serviço | URL |
|---------|-----|
| Página vendas (PV) | http://localhost:3013 |
| Cadastro fallback | http://localhost:3012/version-02/cadastro |
| Painel WABA | http://localhost:3012/version-02/ |

## PV repo
- `D:\pv-waba-disparador` — formulário em `#cadastro` integrado à API WABA
- `.env`: `VITE_WABA_API_URL`, `VITE_WABA_APP_LOGIN_URL`

## Produção (quando DNS propagar)
- Deploy PV no domínio registrado
- Easypanel WABA: `WABA_CORS_ORIGINS`, `WABA_APP_LOGIN_URL`
