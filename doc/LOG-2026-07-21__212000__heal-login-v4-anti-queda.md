# LOG — Endurecer heal login (não pode cair pós-redeploy)

- **Data:** 2026-07-21 ~21:20
- **Incidente:** Após Redeploy `waba_disparador`, login 502 / «recuperação automática»; demorou até heal manual
- **Causa:** publish `:30180` perdido; watch/timer provavelmente inativos após limpeza de writers do Guardião; probe só em `127.0.0.1` (hairpin)
- **Fix v4:**
  - probe local `172.17.0.1:30180` + `127.0.0.1`
  - timer **10s**, burst **2s** × 40
  - watch dispara burst em **1s**
  - workflow Actions: sleep 25s + 2 bursts + assert health
  - Rule: **não** Redeploy por FTP-only; **nunca** disable login-heal
- **Ação VPS obrigatória:** `heal-waba-login-vps.sh install` + status watch/timer `active`

## Palavras-chave

waba-login-heal v4, hairpin 172.17.0.1, timer 10s, não redeploy FTP, watch active
