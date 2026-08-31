# LOG — 2026-07-05 13:45 — validação local healthcheck /live

## Contexto / chats abertos

- Retomada de sessão: fix healthcheck `waba_disparador` oscilando amarelo/verde no Easypanel.
- Pedido anterior: rodar comandos locais e subir deploy.

## Estado do repositório

| Item | Valor |
|------|-------|
| Branch | `master` |
| Commit | `b66b998` — `[7ad89dd] fix: healthcheck stability with /live endpoint` |
| Remote | Sincronizado com `origin/master` |
| Pendente commit | Nenhum (alterações em `dist/` eram só CRLF local — restauradas) |

## Comandos executados

```powershell
cd C:\Users\Usuario\.cursor\projects\e-Waba\waba-repo
Remove-Item -Recurse -Force node_modules
npm install --no-audit --no-fund
npm run build
node dist/index.js  # PORT=3099, background processing off
```

## Validação local

| Endpoint | Resultado |
|----------|-----------|
| `GET http://127.0.0.1:3099/live` | **200** `ok` |
| `GET http://127.0.0.1:3099/health` | marker `DEPLOY-2026-07-05-healthcheck-live-waba-disparador` |

## Validação produção (antes do redeploy)

| Endpoint | Resultado |
|----------|-----------|
| `GET https://waba.draxsistemas.com.br/health` | marker **antigo** `DEPLOY-2026-07-03-healthcheck-ready-waba-disparador` |
| `GET https://waba.draxsistemas.com.br/live` | **401** (versão antiga sem rota `/live`) |
| `GET https://waba.draxsistemas.com.br/ready` | **200** ok |

## Causa da oscilação

Docker HEALTHCHECK em `/ready` atravessava middlewares pesados → timeouts intermitentes. Fix: `/live` ultra-leve + HEALTHCHECK apontando para `/live`.

## Próximo passo

1. **Redeploy** no Easypanel → serviço `waba_disparador` (Git, branch `master`).
2. Confirmar título do deploy com `[b66b998]` ou SHA visível.
3. Após deploy: `GET /health` deve mostrar marker `DEPLOY-2026-07-05-healthcheck-live-waba-disparador`.
4. Container deve ficar **verde estável** (HEALTHCHECK interno em `127.0.0.1:3000/live`).
