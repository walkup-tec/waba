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
