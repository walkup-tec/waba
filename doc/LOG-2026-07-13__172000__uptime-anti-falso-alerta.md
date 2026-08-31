# LOG — Anti falso alerta Monitor (uptime)

**Data:** 2026-07-13 ~17:20  
**Contexto:** Último alerta de desconexão (Fetch failed) **não era real** — sites públicos 200; hairpin do container.

## Precauções adicionadas

1. **Probe local** (já existia): `172.17.0.1:30210/30211/30180` + Traefik `:80` Host  
2. **3ª chance** mesmo com `localUrl`: se local+público falham por rede → Host gateway `:80`  
3. **Confirmação 2 ticks** (`WABA_UPTIME_MONITOR_CONFIRM_FAILURES=2`): 1ª falha = *suspeito* (luz verde, **sem** WhatsApp/e-mail/log desconexão); só na 2ª consecutiva marca DOWN + alerta  
4. **Re-probe imediato** antes de enviar alerta — se voltar OK, descarta falso positivo  

Marker: `DEPLOY-2026-07-13-uptime-anti-false-alert`

## Validar após Redeploy

```bash
curl -sS https://waba.draxsistemas.com.br/health | jq .deployMarker
```

## Keywords
`uptime`, `falso positivo`, `fetch failed`, `confirmFailures`, `reconfirm`, `hairpin`
