# Deploy com Docker (VPS / EasyPanel)

## Imagem

- `Dockerfile` na raiz: build multi-stage (`npm run build` + `npm ci --omit=dev`).
- Base: `node:20.18-alpine`, usuário não-root `nodejs` (uid 1001).
- **Porta:** `PORT` (padrão `3000`). Publicar com `-p 3000:3000` ou proxy reverso.
- **Dados:** monte volume em **`/app/data`** (campanhas, estado local). Sem volume, dados somem ao recriar o container.

## Variáveis de ambiente

Mesmas chaves do `.env` / `.env.example` (sem commitar segredos). Configure no painel ou `--env-file .env`.

## Comandos locais

```bash
docker build -t waba:latest .
docker run -d --name waba -p 3000:3000 --env-file .env -v waba-data:/app/data waba:latest
```

## EasyPanel

- **Build context:** raiz do repositório (onde está o `Dockerfile`).
- **Dockerfile path:** `Dockerfile`.
- **Comando:** padrão da imagem (`node dist/index.js`).
- **Volume:** host ou nomeado → ponto de montagem **`/app/data`**.

## FTP vs Docker

O fluxo GitHub Actions + FTP envia o **bundle** pronto (`ftp-bundle/`). Docker **não** usa esse zip: o host (ou CI) faz `docker build` a partir do código-fonte ou de uma imagem já buildada no registry.

### Meta Embedded Signup (`/meta-oficial/...`)

Rotas como `POST /meta-oficial/embedded-signup/exchange-code` existem **só no processo Node** (`node dist/index.js`). Se o domínio servir **apenas** `index.html` estático (Apache/nginx sem proxy para Node), o browser recebe HTML **404 / Not Found** em vez de JSON — a integração Meta nunca completa. O domínio público tem de apontar para o **mesmo** serviço que executa a API (Docker/EasyPanel ou `node dist/index.js` por trás do proxy).

**Rotas do mesmo handler (troca do `code` Embedded Signup):**

| Método | Path | Para quê |
|--------|------|----------|
| POST | `/waba-embedded-signup-exchange` | Path curto; reduz chance de regra de proxy/CDN quebrar POST em URL longa. |
| POST | `/api/meta/embedded-signup/exchange-code` | Padrão “API” sob `/api`. |
| POST | `/meta/embedded-signup/exchange-code` | **Importante:** se o nginx (ou outro proxy) usar `location /api/ { proxy_pass http://node:3000/; }`, o prefixo `/api` é removido e o Node recebe `/meta/embedded-signup/...` — sem esta rota daria 404/502 com HTML. |
| POST | `/meta-oficial/embedded-signup/exchange-code` | Legado. |

O frontend tenta **nessa ordem** (primeiro `urlencoded`, depois JSON se todas parecerem HTML de proxy).

**EasyPanel / um único app:** o domínio deve apontar para **um** serviço que rode `node dist/index.js` (Docker). Não misture o mesmo host com “site estático” que atenda POST — o POST precisa chegar ao mesmo container que responde `GET /health`.
