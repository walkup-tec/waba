# LOG — WhatsApp operacional nova campanha: 3 instâncias + retry até sucesso

## Contexto

Ao gerar campanha, a mensagem WhatsApp para o operacional (`op_jose@draxsistemas.com.br` e demais) não estava sendo entregue de forma confiável.

**Pedido:** tentar na ordem `51981077770` → `51997462102` → `51981082477`; se todos falharem, repetir a sequência até o primeiro envio com sucesso; parar após sucesso.

## Causa raiz

`waba-operacional-campaign-whatsapp.service.ts` tinha lógica frágil:

- Apenas 2 números configurados; fallback incorreto (`5197462102` em vez de `51997462102`).
- `buildOperacionalSendCandidates` retornava só a primeira instância encontrada — sem fallback real no envio.
- Sem repetição da sequência nem retry em background.

## Solução

1. **Sequência fixa de 3 instâncias** (configurável via env):
   - `WABA_OPERACIONAL_NOTIFY_WHATSAPP_PRIMARY_PHONE=51981077770`
   - `WABA_OPERACIONAL_NOTIFY_WHATSAPP_FALLBACK_PHONE=51997462102`
   - `WABA_OPERACIONAL_NOTIFY_WHATSAPP_TERTIARY_PHONE=51981082477`

2. **Envio síncrono resiliente:** até 15 rodadas (`WABA_OPERACIONAL_NOTIFY_WHATSAPP_MAX_ROUNDS`), delay 2,5s entre rodadas; re-resolve instâncias a cada rodada; `sendEvoTextAlert` com `retries: 2`; ignora instâncias desconectadas e tenta a próxima.

3. **Retry em background:** se o bloco síncrono falhar, agenda retry indefinido (1 rodada completa por tick) até `status: sent`; dedupe por `campaignId:email:whatsapp`.

4. **Deploy marker:** `DEPLOY-2026-07-09-operacional-campanha-whatsapp-3instancias`

## Arquivos alterados

- `src/mail/waba-operacional-campaign-whatsapp.service.ts` — reescrita completa
- `src/deploy-marker.ts`
- `.env.example`
- `dist/` (build)

## Como validar

1. Redeploy Easypanel `waba_disparador` após push em `master`.
2. Gerar campanha de teste (ex.: assinante Bets).
3. Confirmar WhatsApp no número do operacional atribuído.
4. Logs esperados:
   - `[whatsapp] operacional campanha: sequência 51981077770→..., 51997462102→..., 51981082477→...`
   - Em sucesso: `operacional campanha enviada para ... via ...`
   - Se falha temporária: `agendado retry em background até sucesso`

## Segurança

- Nenhum segredo em código; números via env com defaults seguros.
- Logs não expõem tokens Evolution.

## Palavras-chave

`operacionalNotify`, `deliverOperacionalNewCampaignWhatsApp`, `51981077770`, `51997462102`, `51981082477`, `campanha intake`, retry background
