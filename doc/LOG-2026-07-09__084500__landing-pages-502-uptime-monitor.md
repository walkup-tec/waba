# LOG — 2026-07-09 08:45 — Landing pages fora do ar (502) — diagnóstico via monitoramento

## Solicitação
- Usuário reportou landing pages fora do ar; pediu verificação pelo monitoramento do projeto.

## Monitoramento WABA (uptime-monitor)
Alvos padrão em `src/monitoring/uptime-monitor.service.ts`:
| key | URL |
|-----|-----|
| site_drax | https://draxsistemas.com.br/ |
| site_bet | https://bet.waba.info/ |
| site_disparos | https://wabadisparos.com.br/ |
| app_waba | https://waba.draxsistemas.com.br/health |
| asaas_webhook | integração Asaas (se habilitado) |

Alertas: WhatsApp `5551999666841` + e-mail `walkup@walkuptec.com.br` a cada 15 min (produção).

UI admin: `GET /admin/infra/uptime-monitor/lights` (requer sessão autenticada).

## Sondagem externa (curl.exe, 2026-07-09 ~08:48 BRT)
| Alvo | HTTP | Observação |
|------|------|------------|
| bet.waba.info | **502** | flapping 502/000 |
| wabadisparos.com.br | **502** | flapping 502/000 |
| draxsistemas.com.br | **200** | OK |
| waba.draxsistemas.com.br/health | **200** | OK (~0,12s) |
| waba-bets-pv.achpyp.easypanel.host | **502** | backend bets_pv inacessível |
| waba-paginadevendas.achpyp.easypanel.host | **000** | conexão abortada |

3 probes sequenciais (bet + wabadisparos): `502/000`, `000/502`, `502/502` — instabilidade no backend/Traefik, não só router ausente (404).

## Causa provável
- Traefik responde (502 Bad Gateway), mas os serviços Swarm **`waba_paginadevendas`** e **`waba_bets_pv`** estão down, em restart-loop ou com backend `172.17.0.1:PORTA` incorreto no `main.yaml`.
- Padrão já visto em jul/2026: Easypanel regenera config ou containers caem → landings fora; app principal WABA (`30180`) permanece OK.
- SSH desta máquina: `Permission denied (publickey,password)` — correção requer acesso root ao VPS `72.60.51.127`.

## Correção no VPS (root@srv1261237)
```bash
# 1) Diagnóstico rápido
docker service ls | grep -E 'traefik|paginadevendas|bets'
docker service ps waba_paginadevendas --no-trunc | head -5
docker service ps waba_bets_pv --no-trunc | head -5
ss -tlnp | grep -E ':443|:80'

# 2) Se serviços down — subir/rebuild no Easypanel (waba_paginadevendas, waba_bets_pv)

# 3) Restore routers + backend host gateway (script v6)
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/restore-landing-routers-vps.sh" -o /root/restore-landing-routers-vps.sh
sed -i 's/\r$//' /root/restore-landing-routers-vps.sh && chmod +x /root/restore-landing-routers-vps.sh
/root/restore-landing-routers-vps.sh
tail -40 /var/log/restore-landing-routers.log

# 4) Self-healing permanente (se timers ainda não instalados)
/root/traefik-permanent-all-vps.sh run 2>/dev/null || \
  (curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/traefik-permanent-all-vps.sh" -o /root/traefik-permanent-all-vps.sh && \
   sed -i 's/\r$//' /root/traefik-permanent-all-vps.sh && chmod +x /root/traefik-permanent-all-vps.sh && \
   /root/traefik-permanent-all-vps.sh install)
```

## Validação
```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://wabadisparos.com.br/
curl -sS -o /dev/null -w "%{http_code}\n" https://bet.waba.info/
```
Esperado: **200** estável nos dois.

## Arquivos de referência
- `scripts/restore-landing-routers-vps.sh` (v6)
- `scripts/traefik-permanent-all-vps.sh`
- `doc/LOG-2026-07-08__085407__restore-landing-traefik-v6-easypanel-format.md`

## Palavras-chave
landing 502, bet.waba.info, wabadisparos, uptime-monitor, paginadevendas, bets_pv, traefik backend 172.17.0.1
