# Device Cloud — falha após digitar pairingCode

## Sintoma (print 2026-08-21 ~17:57)

- UI: `Tempo esgotado. Gere um novo código e tente de novo.`
- WA: modal `Não foi possível conectar o dispositivo` (número ou código)

## Histórico deste chat (síntese)

| Tema | Achado |
|------|--------|
| Número EM-6034 | `registration_jid` / phones.json = `555182006034` (sem 9º) |
| Sem 9º no create | WA rejeita na hora; EVO `401` / `close` |
| Com 9º `5551982006034` | Chegou a `open` breve (histórico); risco `device_removed` se sessão instável |
| TTL | pairingCode / QR ~60s (doc EVO connect) |
| Ordem | Gerar→depois abrir envelhece o código; open→gerar travava na soft-reset |
| Digitação | 1 char/caixa; falso «navegador» já corrigido |
| Poll 5 min | Sintoma: EVO nunca fica `open` após rejeição do WA |

## Evidência desta falha

EVO `em-6034`: `number=555182006034`, `connectionStatus=close`, `disconnectionReasonCode=401` (~20:54Z).

## Correção

1. Pareamento usa **COM 9º** (`formatDeviceCloudPairingNumber`).
2. **Paralelo:** gerar código + abrir «Insira o código» (`Promise.all`).
3. Após digitar: detectar modal de falha (~20s); dismiss OK; **1 retry** com número alternado (sem 9º).
4. Doc EVO: https://doc.evolution-api.com/v2/api-reference/instance-controller/instance-connect

## Marker

`DEPLOY-2026-08-21-dc-fix-pairing-ttl-number9`

## Validação

Hard refresh → Adicionar ao Aquecedor → status mostra número `5551982006034` → digita → sem modal de erro → EVO `open` estável → Integração Finalizada.
