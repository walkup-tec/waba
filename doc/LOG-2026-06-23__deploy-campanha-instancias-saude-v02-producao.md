# LOG — Deploy campanha instâncias saúde (V02 + produção)

## Pedido

Aplicar alterações no ambiente local V02 e fazer push para deploy em produção.

## Ações

1. `npm run build` em `D:\Waba-master`
2. V02 reiniciado: `scripts/dev-v02.ps1` → `http://localhost:3012/version-02/`
3. Commit `2bf3269` na branch `v02`:
   - `[7ed28e8] feat: campanha min 4 instancias auto + pausa 50% saude | DEPLOY-2026-06-21-campanha-instancias-saude`
4. Fast-forward `master` ← `v02`
5. Push: `origin/master` e `origin/v02`

## Arquivos no commit

- `index.html`
- `src/index.ts`
- `src/disparos/alternativa-dispatch-rules.ts`
- `doc/memoria.md`
- `doc/LOG-2026-06-21__campanha-min-instancias-auto-comprar.md`
- `doc/LOG-2026-06-21__campanha-pausa-50-porcento-saude.md`

## Validação local

- Health V02: `http://localhost:3012/version-02/health` → `ok: true`

## Produção

- Workflow: GitHub Actions **Deploy FTP (bundle)** (push em `master`)
- Verificar: GitHub → Actions → último run após `2bf3269`
- URL: `https://waba.draxsistemas.com.br`

## Observação

- `dist/` não commitado; CI gera bundle via `npm run bundle:ftp`.
