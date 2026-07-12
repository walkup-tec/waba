# LOG — Logs Sistema dentro do Monitor CPU (tela vazia)

**Data:** 2026-07-11 22:23  
**Contexto:** Usuário reportou que o correto era divisão de páginas *dentro* de Monitor CPU (não menu lateral) e que a tela de Logs abria sem informações.

## Causa raiz

1. **Menu lateral** — item separado `admin-logs-sistema` (já removido do registry).
2. **HTML aninhado** — `#admin-logs-sistema-page` ficou *dentro* de `#admin-monitor-cpu-page`. Ao trocar para Logs, o JS fazia `cpuPage.hidden = true`, escondendo o pai e a página de logs junto → tela em branco.
3. **JS incompleto** — `setAdminMonitorPage` / sync de botões agora ligados; ramo de tab `admin-logs-sistema` removido.
4. **Erro API** — fallback de render alinhado ao shape real (`events`/`kpis.eventsPerDay`).

## Solução

- Abas internas em `#admin-monitor-pages`: **Monitor CPU** | **Logs Sistema**
- Páginas irmãs (não aninhadas) sob `#tab-admin-monitor-cpu`
- CSS de `#tab-admin-logs-sistema` removido
- Marker: `DEPLOY-2026-07-11-logs-dentro-monitor-cpu`
- Build: `npm run build:h` com rename temporário de `node_modules` quebrado no H:

## Arquivos

- `index.html` / `dist/index.html`
- `src/deploy-marker.ts` / `dist/deploy-marker.js`
- `src/menus/waba-menu-registry.ts` (sem Logs separado)

## Validar

1. Abrir **Suporte → Monitor CPU**
2. Clicar **Logs Sistema** (botões no topo do painel, não na sidebar)
3. Ver KPIs (zeros ok), gráficos (“Sem desconexões…”) e tabela com mensagem se vazio
4. Em produção: `/health` com marker `DEPLOY-2026-07-11-logs-dentro-monitor-cpu`

## Pendência

- Commit + push `master` + Redeploy Easypanel (só quando usuário pedir “sobe”).

## Keywords

`logs-sistema`, `monitor-cpu`, `pagina-interna`, `tela-vazia`, `hidden-parent`, `admin-monitor-pages`
