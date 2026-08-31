# LOG — V02 Mozart instâncias = Walkup produção

**Data:** 2026-06-22

## Pedido

Mozart (`mozart.pmo@gmail.com`) no localhost V02 deve ver as mesmas instâncias que Walkup em produção, mantido automaticamente para testes.

## Solução

- Script `scripts/sync-mozart-instances-walkup-prod-v02.cjs`:
  - Login produção (`WABA_ADMIN_*` no `.env.v02`)
  - `GET /instancias` → 9 nomes (jun/2026)
  - Grava `data/v02/instance-owners.json` com dono **mozart**
  - Snapshot em `instance-owners-walkup-prod.snapshot.json` (fallback offline)
- `scripts/dev-v02.ps1` executa o sync ao iniciar `npm run dev:v02`

## Instâncias espelhadas (produção walkup)

5181075897, 51981076635, atendimento-6019, atendimento-673, atendimento-8931, atendimento-906, drax, soma, walkup

## Validar

1. `npm run dev:v02` em `D:\Waba-master`
2. Login como **mozart.pmo@gmail.com**
3. Aba Instâncias → 9 linhas (mesmos nomes da produção walkup)

## Manual

```bash
node scripts/sync-mozart-instances-walkup-prod-v02.cjs
```
