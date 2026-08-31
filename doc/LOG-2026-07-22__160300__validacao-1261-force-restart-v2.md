# LOG — Validação 1261 v2: forceRestart + watermark = now

**Data:** 2026-07-22 16:03  
**Marker:** `DEPLOY-2026-07-22-validacao-1261-force-restart-v2`

## Por que ainda falhava (4ª reclamação)

Marker anti-histórico **já estava live** (`…anti-historico-evo`). Às 18:57 UTC a EVO **chegou a enviar** `WABA-VAL:6c354313` — mas o fluxo UI ainda quebrava:

1. **`forceRestart: Boolean(registerInboundValidationId)`** — no retry o id era limpo **antes** do POST → `forceRestart:false` → backend **reaproveitava** a validação antiga (CONFIRMAR já “recebido”).
2. Watermark só usava max do histórico; com skew de 2s ainda podia aceitar CONFIRMAR da tentativa imediatamente anterior.
3. `referenceJid` ficava em `@lid` mesmo com `remoteJidAlt` telefone.
4. UI mostrava `+55 51 8200-1261` (sem 9) — confunde o envio pelo outro WhatsApp.

## Correção v2

| Item | Fix |
|------|-----|
| UI POST | `forceRestart: true` **sempre** |
| Watermark | `max(histórico EVO, Date.now() do start)` → só mensagem **depois** do início |
| markInbound | preferir telefone / `@s.whatsapp.net` |
| Telefone UI | exibir com 9º dígito (`+55 51 98200-1261`) |
| Dedupe | limpa reply dedupe da instância no restart |

## Teste offline (PASS)

12× CONFIRMAR no dump 1261 → `falseReceiveWouldPass=0` com watermark = max(captured, now).

## Produção

1. Push + **Redeploy** `waba_disparador` (Node precisa carregar o JS).
2. `/health` → `DEPLOY-2026-07-22-validacao-1261-force-restart-v2`.
3. Hard refresh (Ctrl+Shift+R).
4. Validar 1261: **sem** enviar CONFIRMAR → permanece aguardando.
5. Enviar CONFIRMAR **novo** → reply com `WABA-VAL:` novo no WhatsApp do outro número.

## Palavras-chave

1261, forceRestart, watermark now, @lid, 9 digito, quarta vez
