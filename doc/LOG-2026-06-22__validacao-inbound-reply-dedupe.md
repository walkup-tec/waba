# LOG — Validação inbound: uma resposta por integração

**Data:** 2026-06-22  
**Marker:** `DEPLOY-2026-06-22-validacao-inbound-reply-dedupe`

## Problema

Durante integração de instância, o número de teste recebeu **6 mensagens** `Validação WABA concluída. WABA-VAL:…` (IDs diferentes) após um único `CONFIRMAR`.

## Causa

Cada `POST /validacao-inbound` removia a validação anterior do `Map` mas **não cancelava o loop assíncrono** — loops órfãos continuavam ativos e todos respondiam ao mesmo `CONFIRMAR`.

## Correção

1. **Uma validação ativa por instância** — novo POST retorna a sessão existente (idempotente).
2. **`cancelled`** nos loops substituídos — param de enviar.
3. **Deduplicação de resposta** por conversa (`instância + chat`) por 15 min.
4. **Frontend** — bloqueio de POST duplicado (`registerInboundStartInFlight`).

## Arquivos

- `src/instance-inbound-validation.service.ts`
- `index.html`
- `src/deploy-marker.ts`

## Validar

1. Integrar instância → enviar `CONFIRMAR` uma vez.
2. Deve chegar **apenas 1** mensagem `Validação WABA concluída`.
