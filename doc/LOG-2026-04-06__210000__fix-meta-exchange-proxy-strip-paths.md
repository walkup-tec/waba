# LOG: Embedded Signup — rotas extras para proxy que remove `/api`

## Problema

502/HTML «Not Found» no `exchange-code` com `GET /health` e `GET .../config` em JSON: o pedido **POST** muitas vezes **não chega** ao handler Express. Causa frequente em nginx: `location /api/ { proxy_pass http://upstream:3000/; }` **remove** o prefixo `/api`, enviando ao Node `POST /meta/embedded-signup/exchange-code` — rota que **não existia** (só havia `/api/meta/...` e `/meta-oficial/meta/...`).

## Solução

1. Registrar o **mesmo** `metaEmbeddedSignupExchangeCodeHandler` em:
   - `POST /waba-embedded-signup-exchange` (path curto)
   - `POST /meta/embedded-signup/exchange-code` (pós-strip de `/api`)
   - rotas já existentes
2. Frontend: tentar **nessa ordem** os quatro paths (form, depois JSON se respostas forem “HTML de proxy”).
3. Mensagens de erro na UI ajustadas para PT-BR e menção a `curl` na porta interna.

## Arquivos

- `src/index.ts` — `app.post` extras + comentário JSDoc
- `index.html` — `metaPostEmbeddedExchangeCode`, textos em `metaPost`
- `doc/deploy-docker.md` — tabela de rotas e nota nginx/EasyPanel

## Validar

```bash
# Na máquina onde o Node escuta (porta do container):
curl -sS -X POST "http://127.0.0.1:3000/waba-embedded-signup-exchange" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "code=teste"
# Esperado: JSON (400 ou erro Meta), nunca HTML.
```

## Palavras-chave

`exchange-code`, `proxy_pass`, `strip /api`, `502`, `nginx`, `waba-embedded-signup-exchange`
