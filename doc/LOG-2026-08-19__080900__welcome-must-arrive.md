# Boas-vindas WhatsApp obrigatória: fila completa + JID canônico

## Contexto do pedido

A mensagem de boas-vindas tem de chegar no WhatsApp do assinante, sem exceção. Nara e Carlos Cesar não receberam no cadastro nem no reenvio.

## Causa

1. Boas-vindas travavam no número eleito (`drax` / 51981077770). Com ele `close`, o código podia não tratar o próximo da fila como envio válido até 3 ACK ERROR.
2. Reenviar respondia `202` na hora (sucesso na UI) sem esperar ACK de aparelho.
3. O número digitado nem sempre é o JID canônico (Nara: 5541989006946 → `554189006946`).

## Solução implementada

- Fila 77770 → walkup → 2477 em toda rodada; ausente/desconectado pula; se ninguém da fila, qualquer EVO `open`.
- Removido `welcomeRetryPrimaryOnly`.
- Antes do `sendText`, `whatsappNumbers` escolhe o JID `exists:true`.
- Só `DELIVERY_ACK`/`READ`/`PLAYED` conta como enviado; senão tenta o próximo e retenta em background (até 40 vezes).

## Arquivos criados/alterados

- `src/mail/waba-evolution-whatsapp-delivery.service.ts`
- `src/mail/waba-whatsapp-exists-number.ts`
- `scripts/test-welcome-canonical-number.cjs`
- `scripts/verify-welcome-routing-rules.cjs`
- `src/deploy-marker.ts` / `dist/` correspondente
- `.cursor/project-memory/02-BUSINESS_RULES.md` e correlatos
- Este LOG e `doc/memoria.md`

## Como validar

- `node scripts/test-welcome-canonical-number.cjs`
- `node scripts/verify-welcome-routing-rules.cjs`
- `GET /health` com marker `DEPLOY-2026-08-19-080900-welcome-must-arrive`
- Após deploy: Admin · Reenviar para Nara e Carlos Cesar; mensagem no celular (não probe `sendText` extra)

## Observações de segurança

- Sem novo `sendText` neste passo. Sem segredos no LOG.

## Palavras-chave

`boas-vindas` `obrigatória` `fila` `51981077770` `walkup` `exists:true` `canonical` `ACK`
