# LOG — Boas-vindas WhatsApp: ACK + failover de instância

## Contexto do pedido

Mensagem de boas-vindas do assinante Alexandre Rangel aparecia na Evolution (`drax-oficial`) mas **não no celular**. `MessageUpdate.status = ERROR` após `sendText` HTTP 2xx.

## Ações executadas

- Investigação: `findMessages` em `drax-oficial` para `5527999848180` — texto de boas-vindas com ACK `ERROR` / chat `PENDING`.
- Hipótese (alta): o delivery WABA marcava `sent` só com HTTP 201, sem conferir ACK, e não tentava `walkup` / `2477`.
- Implementação da conferência de ACK de aparelho e failover na sequência de instâncias.

## Solução implementada

1. Após `sendText` OK, o WABA consulta `findStatusMessage` / `findMessages` na origem.
2. Só considera entregue com `DELIVERY_ACK`, `READ` ou `PLAYED`.
3. `ERROR` / `FAILED` / timeout em `PENDING`/`SERVER_ACK` → tenta a próxima instância (51981077770 → 51997462102 → 51981082477).
4. Boas-vindas passam `backgroundRetryKey` (até 12 retries) se a primeira sequência falhar.

## Arquivos criados/alterados

- `src/mail/waba-evolution-delivery-ack.ts` (novo)
- `src/mail/waba-evolution-whatsapp-delivery.service.ts`
- `src/mail/waba-welcome-whatsapp.service.ts`
- `src/monitoring/evo-text-alert.client.ts`
- `src/deploy-marker.ts` — `DEPLOY-2026-08-14-welcome-whatsapp-ack-failover`

## Como validar

1. `npm run build`
2. Deploy/redeploy produção (Dockerfile copia `dist/`)
3. Admin → Assinantes → Reenviar boas-vindas para Alexandre Rangel
4. Confirmar no celular dele (não só no histórico Evolution)
5. Health/marker: `DEPLOY-2026-08-14-welcome-whatsapp-ack-failover`

## Observações de segurança

Sem exposição de chaves. Consultas Evolution usam `EVO_API_KEY` só no backend.

## Palavras-chave

`boas-vindas`, `ACK`, `DELIVERY_ACK`, `MessageUpdate ERROR`, `failover instância`, `drax-oficial`, `walkup`
