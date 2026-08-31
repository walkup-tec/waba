# LOG — Ambientes V01 e V02 separados de produção

**Data:** 2026-06-08

## Solicitação

Dois ambientes de desenvolvimento separados de produção:
- **V01:** tudo feito até aqui (= baseline de produção hoje)
- **V02:** desenvolvimento diário a partir de hoje (mesmo conteúdo inicial, evolui todo dia)

## Implementado no repo

| Artefato | Função |
|----------|--------|
| `src/load-env.ts` | Carrega `.env.v01` / `.env.v02` via `WABA_ENV` |
| `src/data-path.ts` | Dados em `data/v01/` e `data/v02/` |
| `.env.v01.example` / `.env.v02.example` | Templates |
| `scripts/init-env-v01-v02.ps1` | Bootstrap local |
| `scripts/dev-v01.ps1` / `dev-v02.ps1` | Atalhos Windows |
| `npm run dev:v01` / `dev:v02` | Portas 3011 / 3012 |
| `doc/AMBIENTES-V01-V02.md` | Guia Git + VPS + Evolution |

`GET /health` retorna `wabaEnv`.

## Pendências operacionais

1. `npm run init:env` + preencher `.env.v01` / `.env.v02` (Supabase/EVO não-produção)
2. Criar branches Git `v01` e `v02`
3. Easypanel: serviços `waba_disparador_v01` e `_v02` (opcional VPS)
4. Evolution/Postgres/Redis dedicados por ambiente

## Validação

- `npm run build` — OK
