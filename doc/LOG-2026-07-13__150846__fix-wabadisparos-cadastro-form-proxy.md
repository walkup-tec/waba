# LOG — Fix cadastro wabadisparos.com.br (#cadastro sem ação)

## Contexto
Usuário: botão "Criar Conta" em https://wabadisparos.com.br/#cadastro não faz nada.

## Causa raiz
Landing SPA (`walkup-tec/pv-waba-disparador`, serviço `waba_paginadevendas` :30210) tinha `REGISTER_HREF = "#cadastro"` e a seção `#cadastro` era só outro CTA para `#cadastro` — **sem formulário** e sem chamada a `POST /subscribers/register`.

O formulário funcional existe em `public-pages/vendas.html` / `/cadastro` no app WABA (`waba.draxsistemas.com.br/cadastro`), mas a landing de produção não o usava.

## Solução (repo PV)
Commit `3826a02` em `walkup-tec/pv-waba-disparador`:
- `RegisterForm` na seção `#cadastro`
- Proxy server `POST /api/subscribers/register` → `https://waba.draxsistemas.com.br/subscribers/register`
- `signupOrigin: wabadisparos`, `segment: outros`
- `.env.example` com `WABA_API_URL` / `VITE_WABA_APP_LOGIN_URL`

Padrão igual a `betwaba-connect` (evita CORS no browser).

## Deploy necessário
Redeploy Easypanel do serviço **`waba_paginadevendas`** (Git `pv-waba-disparador` @ `3826a02`).

## Validação
1. Abrir https://wabadisparos.com.br/#cadastro → ver formulário
2. Preencher e submeter → 200 + redirect para painel
3. `curl -sS -o /dev/null -w "%{http_code}" -X POST https://wabadisparos.com.br/api/subscribers/register -H "Content-Type: application/json" -d "{}"` → 4xx da API (não 404)

## WABA
- `.env.v02.example`: CORS de exemplo inclui landings (opcional com proxy)

## Keywords
wabadisparos, #cadastro, RegisterForm, pv-waba-disparador, subscribers/register, paginadevendas
