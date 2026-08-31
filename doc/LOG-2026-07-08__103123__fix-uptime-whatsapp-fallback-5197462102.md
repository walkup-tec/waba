# LOG — 2026-07-08 10:31 — Fix fallback WhatsApp do uptime (número errado)

## Sintoma
Usuário pausou `bets_pv` → e-mail de alerta chegou; WhatsApp **não**.

## Regra informada (e usada no resto do WABA)
- Destino alerta: WhatsApp `51999666841` + e-mail `walkup@walkuptec.com.br`
- Envio via instância **`51981077770`**; se offline → **`5197462102`**
  (mesma regra de boas-vindas / operacional)

## Bug
No uptime monitor o fallback foi tipado **`51997462102`** (dígito `9` a mais / número inexistente), em:
- `src/monitoring/uptime-monitor.service.ts` (`DEFAULT_FALLBACK_PHONE`)
- `.env.example` (`WABA_UPTIME_MONITOR_FALLBACK_PHONE`)
- LOG 2026-07-07 150500 (documentou o typo)

Com 77770 offline ou não resolvida, o fallback não acha instância → `sendText` falha; SMTP segue e o e-mail chega.

## Correção
- Fallback → `5197462102` em src, `.env.example`, dist
- Se no Easypanel existir `WABA_UPTIME_MONITOR_FALLBACK_PHONE=51997462102`, corrigir/remover (env sobrescreve o default)

## Validação pós-redeploy
1. Marker / commit com o fix
2. `POST /admin/infra/uptime-monitor/test-alert` → WhatsApp + e-mail
3. Ou re-pausar bets e aguardar ciclo / `run?forceAlert=1`

## Palavras-chave
uptime whatsapp falhou, fallback 5197462102, typo 51997462102, bets_pv alerta
