# LOG: Login assinante — resiliência e mensagem amigável (Failed to fetch)

## Contexto

Usuário reportou erro **"Failed to fetch"** ao tentar login de assinante (`mozart.pmo@gmail.com`) em aba anônima em `https://waba.draxsistemas.com.br`. Mensagem técnica exposta na UI — inaceitável em produção.

## Diagnóstico

- `POST /auth/login` responde **401** com senha errada e **200** com credenciais válidas (testes via PowerShell/curl).
- Falhas intermitentes de rede (`ECONNRESET`, timeout na página principal ~20s) — não é credencial inválida nem corrupção de `waba-subscribers.json` pela migração master walkup.
- UI fazia `fetch("/auth/login")` sem retry e propagava `error.message` literal (`Failed to fetch`).

## Solução

1. **`index.html`**
   - `resolveWabaLoginErrorMessage`: traduz erros de rede/timeout para mensagem amigável em PT.
   - `fetchWabaAuthJson`: retry com backoff (até 3 tentativas) para login, session e logout.
   - Submit do login usa timeout 30s e 3 retries.

2. **`src/auth/waba-auth.routes.ts`**
   - `POST /auth/login` envolvido em `try/catch` → **500 JSON** em falha interna em vez de crash silencioso.

3. **`src/deploy-marker.ts`**
   - Marker: `DEPLOY-2026-06-25-login-resilience-retry`

## Arquivos alterados

- `index.html`, `dist/index.html`
- `src/auth/waba-auth.routes.ts`, `dist/index.js`
- `src/deploy-marker.ts`

## Como validar

1. Após redeploy Node (Easypanel): `GET /health` → `deployMarker` = `DEPLOY-2026-06-25-login-resilience-retry`.
2. Após deploy FTP/bundle: página de login não exibe mais "Failed to fetch" literal.
3. Login assinante `mozart.pmo@gmail.com` em aba anônima com senha correta → reload e app desbloqueado.
4. Simular rede instável: mensagem "Não foi possível contactar o servidor..." após retries.

## Segurança

- Sem exposição de segredos; mensagens genéricas em erro 500.

## Palavras-chave

`login`, `Failed to fetch`, `fetchWabaAuthJson`, `resolveWabaLoginErrorMessage`, `auth/login`, retry, assinante, mozart
