# LOG — 2026-07-07 14:45 — 404/flapping em bet.waba.info e wabadisparos.com.br

## Solicitação
- Produção com 404 em `https://bet.waba.info/` e `https://wabadisparos.com.br/` (print: "404 Page not found / Go home").
- "resolve essa merda".

## Diagnóstico (executado local, curl/DNS)
- DNS: ambos → `72.60.51.127` (VPS principal `srv1261237`). OK.
- Easypanel hosts internos:
  - `waba-paginadevendas.achpyp.easypanel.host` → **200** (serviço `waba_paginadevendas` NO AR)
  - `waba-bets-pv.achpyp.easypanel.host` → **404** (serviço `waba_bets_pv` intermitente/não publicado)
  - `waba.draxsistemas.com.br` → 200 (produção principal OK)
- Domínios custom (instáveis / flapping):
  - `wabadisparos.com.br/` → ora **200** (serve landing Drax), ora **404** (página padrão Easypanel), ora **000 timeout**.
  - `bet.waba.info/` → mesmo comportamento.
  - Sondagem de rotas: `/cadastro`, `/login`, `/dashboard`, `/app` → **timeout 000**; `/vendas` → 404; `/version-01/` e `/version-02/` → 307.
- Body do 200 = app React SSR "Drax — Disparos de WhatsApp em Escala" (não é 404 padrão). O 404 do print é a página default do Easypanel quando o router do host custom não existe.

## Causa raiz
- O router Traefik dos domínios custom (`wabadisparos.com.br`, `bet.waba.info`) **desaparece** quando o Easypanel regenera sua config (redeploy/restart) → cai na página 404 padrão.
- Timeouts (000) indicam também instabilidade/sobrecarga do backend (verificar CPU/restart-loop do serviço no VPS).
- Os scripts self-healing existem no repo (`scripts/traefik-permanent-paginadevendas-vps.sh` e `traefik-permanent-bets-pv-vps.sh`, commit 06/07, presentes em `origin/master`), mas **não foram instalados no VPS** ainda → sem timer para reaplicar o router.

## Correção (executar no VPS root@72.60.51.127 — SSH)
1. Diagnóstico de serviços/CPU (ver estado real).
2. Instalar permanent paginadevendas → cria router `wabadisparos.com.br` + timer 20s + watch docker events.
3. Instalar permanent bets_pv → idem `bet.waba.info` (confirmar que serviço `waba_bets_pv` existe/está up no Easypanel; se easypanel host = 404, publicar/subir o serviço primeiro).

Comandos (raw do master):
```
# paginadevendas → wabadisparos.com.br
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/traefik-permanent-paginadevendas-vps.sh" -o /root/traefik-permanent-paginadevendas-vps.sh
sed -i 's/\r$//' /root/traefik-permanent-paginadevendas-vps.sh
chmod +x /root/traefik-permanent-paginadevendas-vps.sh
/root/traefik-permanent-paginadevendas-vps.sh install

# bets_pv → bet.waba.info
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/traefik-permanent-bets-pv-vps.sh" -o /root/traefik-permanent-bets-pv-vps.sh
sed -i 's/\r$//' /root/traefik-permanent-bets-pv-vps.sh
chmod +x /root/traefik-permanent-bets-pv-vps.sh
/root/traefik-permanent-bets-pv-vps.sh install
```

## Validação
- `curl -sS -o /dev/null -w "%{http_code}\n" https://wabadisparos.com.br/` → 200 estável
- `curl -sS -o /dev/null -w "%{http_code}\n" https://bet.waba.info/` → 200 estável
- `/root/traefik-permanent-paginadevendas-vps.sh status` e `.../bets-pv status` → timers ativos

## Observações
- SSH não configurado nesta máquina (Permission denied publickey/password) → correção final é no VPS.
- Segredos não expostos.

## Pendências / retomada
- Confirmar no Easypanel se `waba_bets_pv` está publicado e up (easypanel host retornou 404).
- Se timeouts persistirem após routers OK → checar CPU/restart-loop (`vps-cpu-report.sh`, `docker service ps`).
- Palavras-chave: traefik permanent, wabadisparos, bet.waba.info, paginadevendas, bets_pv, 404 flapping, easypanel router.
