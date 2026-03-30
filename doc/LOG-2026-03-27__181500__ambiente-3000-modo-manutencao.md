# Log: manutenção do ambiente na porta 3000 (produção)

## Contexto

Pedido: suporte a **manutenção** no ambiente que roda em **porta 3000** (`npm run start:prod`), sem ambiguidade para probes e com bloqueio seguro de API durante janela de manutenção.

## Solução

1. **Variáveis de ambiente**
   - `MAINTENANCE_MODE` — `true`/`1`/`on` ativa o modo (padrão: desligado).
   - `MAINTENANCE_RETRY_AFTER_SEC` — cabeçalho `Retry-After` (30–86400, default 120).
   - `MAINTENANCE_MESSAGE` — texto exibido na página/HTML e no JSON 503 (opcional).

2. **Comportamento com `MAINTENANCE_MODE=true`**
   - **Tick de campanhas** não inicia (e combina com `ENABLE_BACKGROUND_PROCESSING=false` no script de manutenção).
   - **GET /** e **GET /index.html** → resposta HTML 503 com página simples “Manutenção em andamento”.
   - **Ativos estáticos** do `dist` (`.js`, `.css`, imagens, fontes, etc.) continuam servindo via `express.static` para não quebrar caches/CDN pontuais; **demais rotas** → JSON 503 com `maintenance`, `message`, `retryAfterSec`.
   - **Sempre liberados**: `GET /health`, `GET /ready`, `GET /service/maintenance`, `GET /maintenance` (este último redireciona para `/` quando não está em manutenção).

3. **Probes**
   - `/health` → **200** (liveness): inclui `maintenanceMode`, `port`, `runtimeMode`, `backgroundProcessing`.
   - `/ready` → **503** em manutenção (readiness “não receber tráfego”), **200** caso contrário.

4. **Script npm**
   - `npm run start:prod:maintenance` — `PORT=3000`, `RUNTIME_MODE=production`, `ENABLE_BACKGROUND_PROCESSING=false`, `MAINTENANCE_MODE=true`, `node dist/index.js`.

## Arquivos alterados

- `src/index.ts`
- `package.json`
- `doc/LOG-2026-03-27__181500__ambiente-3000-modo-manutencao.md`
- `doc/memoria.md`

## Como validar

```bash
npm run build
npm run start:prod:maintenance
```

Em outro terminal:

- `curl -s http://localhost:3000/health`
- `curl -s -o NUL -w "%{http_code}" http://localhost:3000/ready` → esperado `503`
- `curl -s http://localhost:3000/dados` → JSON com `maintenance: true`

Encerrar manutenção: subir de novo com `npm run start:prod` (sem `MAINTENANCE_MODE`).

## Segurança

- Mensagens configuráveis não devem conter dados sensíveis; o HTML escapa `<` na mensagem.

## Palavras-chave

`MAINTENANCE_MODE`, `start:prod:maintenance`, porta-3000, `/health`, `/ready`, `/service/maintenance`
