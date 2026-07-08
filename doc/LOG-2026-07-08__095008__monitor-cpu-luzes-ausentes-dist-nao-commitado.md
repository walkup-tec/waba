# LOG — 2026-07-08 09:50 — Monitor CPU luzes ausentes em produção (dist não commitado)

## Sintoma
Deploy Easypanel com título `[6adfd1d] feat(ui): luzes status Monitor CPU + sininho vermelho walkup` concluiu com sucesso (07/07 ~19:21 GMT), mas UI do Monitor CPU em produção **não** mostra a faixa de luzes / sininho.

## Causa raiz
Dockerfile produção:
```
COPY dist ./dist
```
Não copia `index.html` da raiz nem `src/`.

Commit `6adfd1d` / mirror `880346e` alterou apenas:
- `index.html` (raiz)
- `src/admin/waba-admin.routes.ts`
- `src/monitoring/uptime-monitor.service.ts`
- docs

**Não** commitou:
- `dist/index.html`
- `dist/monitoring/uptime-monitor.service.js`
- `dist/admin/waba-admin.routes.js` / `dist/index.js` com scheduler

`origin/master` não contém `admin-uptime-lights` em `dist/index.html` nem rota `uptime-monitor/lights` no bundle servido.

O build Docker “Success” só empacotou o `dist/` antigo do Git → feature nunca entrou no container.

## Correção (quando usuário autorizar produção)
No branch de deploy (`master`), a partir do commit com a UI:
1. `npm run build`
2. Commit `dist/` (+ marker se usar)
3. Push `master` → redeploy Easypanel
4. Hard refresh; abrir Monitor CPU (master)

Workspace local `v02` já tem luzes em `dist/index.html` / `dist/monitoring/uptime-monitor.service.js` (trabalho não publicado nesse deploy).

## Validação pós-fix
```bash
# no container ou via HTTPS autenticado master
curl -sS ... /admin/infra/uptime-monitor/lights   # 200 + lights[]
# UI: faixa #admin-uptime-lights acima do Monitor CPU
```

## Palavras-chave
dist não commitado, Monitor CPU luzes, Dockerfile COPY dist, 6adfd1d, uptime lights produção
