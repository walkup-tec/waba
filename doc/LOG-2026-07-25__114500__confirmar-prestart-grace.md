# LOG — CONFIRMAR preso no Passo 3 (watermark stale)

## Contexto
Após QR OK, Passo 3 («Validar envio e recepção») ficava em Processando mesmo com CONFIRMAR já enviado para +55 51 98107-6635.

## Doc EVO consultada
- Create / Connect (QR): índice em https://doc.evolution-api.com/llms.txt
- Detecção inbound: `POST /chat/findMessages/{instance}` + `POST /chat/findChats/{instance}` (`lastMessage` — modo @lid)
- Refs internas: LOG-2026-07-01 lid-findchats; LOG-2026-07-22 aceita CONFIRMA

## Causa
`keywordHighWaterMarkMs = max(captured, Date.now())` + `minTs = max(start−skew, watermark+1)`  
→ qualquer CONFIRMAR já na caixa (enviado enquanto o passo inicia / antes do `forceRestart`) era **stale** para sempre.

## Correção
1. Watermark = só `captured` (não elevar a `now`)
2. `minTs` = `start − 180s` (graça pré-start); histórico antigo continua fora
3. Poll: sempre `resolveInboundHit` (findMessages ∥ findChats), deep no GET da UI
4. Marker: `DEPLOY-2026-07-25-confirmar-prestart-grace`

## Teste interno
```
node scripts/test-inbound-confirm-watermark.mjs
→ case1–4 OK, {"ok":true,"graceMs":180000}
```
(Prova que o bug antigo rejeitava CONFIRMAR de 15s atrás e o novo aceita.)

## Validar pós-deploy
1. Marker no `/health`
2. Passo 3: se já enviou CONFIRMAR nos últimos ~3 min, deve avançar; senão reenviar
3. Resposta automática «Validação WABA…»

## Palavras-chave
CONFIRMAR, watermark, prestart grace, forceRestart, findChats lastMessage, Passo 3
