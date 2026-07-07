# LOG — 2026-07-07 15:40 — Luzes de status acima do Monitor CPU + sininho vermelho (walkup)

## Solicitação
No ambiente de produção (tela Monitor CPU), criar acima dele uma linha com os pontos monitorados inline, cada um com uma luz:
- verde = comunicando / no ar
- vermelho = fora do ar
Se qualquer luz estiver vermelha, **somente para o usuário `walkup@walkuptec.com.br`**, o sininho de notificação pulsa em vermelho e mostra o aviso "Sistema fora do ar".

## Solução implementada
Reaproveita o monitor de uptime (`src/monitoring/uptime-monitor.service.ts`) já existente.

### Backend
- `getUptimeLights({fresh})` — checagem **rápida** (2 tentativas, timeout 6s) dos mesmos alvos do monitor (draxsistemas, bet.waba.info, wabadisparos, waba.draxsistemas/health, Asaas), com **cache de 45s** (`WABA_UPTIME_MONITOR_LIGHTS_CACHE_MS`). Não envia alertas nem grava estado (separado da checagem robusta de 3 tentativas que dispara WhatsApp/e-mail).
- `checkHttpTarget(target, {attempts, timeoutMs})` — agora aceita opções.
- Rota master `GET /admin/infra/uptime-monitor/lights` (retorna `{checkedAt, allOk, lights[]}`).

### Frontend (`index.html`)
- Faixa `#admin-uptime-lights` inserida **acima** do conteúdo do painel Monitor CPU (logo após o header). Cada ponto = bolinha (verde `is-ok` / vermelho pulsante `is-down`) + label; `title` com detalhe (HTTP/erro).
- Polling acoplado ao ciclo do alerta de CPU do master (`startMasterCpuAlertPolling` / interval 60s / `stopMasterCpuAlertPolling`): `refreshUptimeLights()`.
- Sininho: novo estado `has-system-down` (pulso **vermelho**) + item "⚠️ Sistema fora do ar" no topo da lista, ativado **apenas** quando `wabaSessionEmail === walkup@walkuptec.com.br` E alguma luz vermelha (`setSystemDownActive`). Para os demais usuários master, a faixa de luzes aparece, mas o sininho não fica vermelho.
- CSS: `.uptime-lights`, `.uptime-light-dot.is-ok/.is-down`, `@keyframes uptime-light-pulse`, `.waba-push-bell-btn.has-system-down` + `@keyframes waba-push-bell-pulse-red`.

## Arquivos alterados
- `src/monitoring/uptime-monitor.service.ts` (getUptimeLights, checkHttpTarget opts)
- `src/admin/waba-admin.routes.ts` (import + rota `/lights`)
- `index.html` (HTML faixa, CSS, JS: render/polling/sininho)
- `dist/*` (build)

## Validação
- `npm run build` → OK.
- `getUptimeLights` local: retorna `lights[]` por alvo com ok/detail; `allOk` reflete o conjunto. (bet/wabadisparos oscilaram vermelho por causa do flapping de Traefik ainda não corrigido no VPS — luzes refletem a realidade.)
- Lint: sem erros.

## Observações
- Endpoint só master; faixa visível na aba Monitor CPU (master). Sininho vermelho exclusivo do walkup.
- Luzes usam 2 tentativas (não 3) para snappiness; ainda assim toleram 1 blip. O flapping real de `bet.waba.info`/`wabadisparos.com.br` só some após instalar os scripts `traefik-permanent-*` no VPS (ver LOG 2026-07-07 144500).

## Pendências / retomada
- Deploy ("sobe para o servidor") — feito em `master` só do monitor; esta UI está em `v02` no momento. Publicar quando aprovado.
- Palavras-chave: luzes status, uptime lights, sininho vermelho, sistema fora do ar, walkup, monitor cpu, admin/infra/uptime-monitor/lights.
