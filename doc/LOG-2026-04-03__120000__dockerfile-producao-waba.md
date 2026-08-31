# LOG — Dockerfile produção Waba

## Contexto

Suporte à publicação em VPS/EasyPanel com Docker: imagem Node multi-stage, não-root, volume para `data/`.

## Solução

1. **`Dockerfile`** — estágio `builder`: `npm ci` + `npm run build`; estágio `runner`: `npm ci --omit=dev`, cópia de `dist/`, usuário `nodejs`, `EXPOSE 3000`, `VOLUME /app/data`, `HEALTHCHECK` em `/health`.
2. **`.dockerignore`** — exclui `node_modules`, `.env`, `dist`, `ftp-bundle`, artefatos locais.
3. **`doc/deploy-docker.md`** — comandos `docker build`/`docker run`, notas EasyPanel e diferença FTP vs Docker.

## Arquivos criados/alterados

- `Dockerfile` (novo)
- `.dockerignore` (novo)
- `doc/deploy-docker.md` (novo)
- `doc/memoria.md` (entrada)
- `doc/LOG-2026-04-03__120000__dockerfile-producao-waba.md` (este)

## Como validar

Em máquina com Docker:

```bash
docker build -t waba:latest .
docker run --rm -p 3000:3000 --env-file .env -v waba-data:/app/data waba:latest
```

Abrir `http://localhost:3000/health`.

## Segurança

- Nenhum segredo no Dockerfile; usar `--env-file` ou variáveis do painel.

## Palavras-chave

`Docker`, `node:20.18-alpine`, `PM2-alternativa`, `EasyPanel`, `/app/data`
