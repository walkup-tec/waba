# LOG — favicon deploy produção (master)

**Data:** 2026-06-09  
**Commit:** `91d4a8f` — `fix: favicon WABA igual Typebot admin (ico + favcon.png)`  
**Branch:** `master` → `origin/master` (push OK)

## Alterações
- `favicon.ico` na raiz + `media/favcon.png`, `media/favicon.ico`, `media/favicon.png`
- `index.html` / `dist/index.html`: links favicon padrão Typebot admin
- `scripts/copy-index-html.mjs`: copia `favicon.ico` para `dist/` no build

## Comandos
- `git stash` (v02 WIP) → `checkout master` → build → commit → `git push origin master`
- `checkout v02` + `stash pop`

## Validação pós-deploy
1. Easypanel: redeploy `waba_disparador` (branch `master`)
2. `https://waba.draxsistemas.com.br/` — hard refresh (`Ctrl+Shift+R`) na aba
3. Favicon deve ser o mesmo do Typebot admin

## Pendências
- v02: disparos, UI, docs ainda no stash restaurado (não incluídos neste commit)
