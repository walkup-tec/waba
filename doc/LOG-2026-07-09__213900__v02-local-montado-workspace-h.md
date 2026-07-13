# LOG — 2026-07-09 — V02 local montado no workspace H:

## Pedido

Rodar comandos locais para montar V02 local (= produção).

## Ações

1. `npm run init:env` — criou `.env.v02`, `.env.v01`, `data/v02/`
2. `npm run build:h` — build OK
3. Fix `scripts/run-ts-dev.cjs` — dev no H: usa `dist/index.js` (ts-node falhava sem node_modules)
4. `npm run dev:v02` — servidor **rodando** em background

## Validação

```
GET http://localhost:3012/version-02/health
```

- `ok: true`
- `wabaEnv: v02`
- `uiProfile: production`
- `deployMarker: DEPLOY-2026-07-09-uptime-diagnose-playbooks` (código = prod)
- `dataDir: H:\Meu Drive\Drive Profissional\Waba\data\v02`

## Pendências (paridade dados/segredos)

Não encontrado backup de `D:\Waba` / `E:\Waba` nesta máquina:

| Item | Status |
|------|--------|
| `.env.v02` segredos (login, Supabase, EVO, Asaas, SMTP) | vazio — copiar do backup ou Easypanel |
| `data/v02/*.json` (assinantes, staff, créditos…) | vazio — restaurar backup ou sync manual |

Preencher `.env.v02` e reiniciar `npm run dev:v02` para login master e integrações.

## Arquivos alterados

- `scripts/run-ts-dev.cjs` (novo/ajustado)
- `package.json` — dev scripts usam run-ts-dev.cjs
- `doc/SETUP-H-DRIVE.md`

## Palavras-chave

`v02 local`, `localhost:3012`, `run-ts-dev`, `init:env`, `data/v02 vazio`
