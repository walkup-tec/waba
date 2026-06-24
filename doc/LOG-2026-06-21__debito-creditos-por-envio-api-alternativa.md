# LOG — Débito de créditos por envio API Alternativa

**Pedido:** cada envio do disparador API Alternativa deve debitar do saldo de envios contratados.

## Problema

- Criação de campanha debitava todo o lote de uma vez no bucket `oficial` (apiKind padrão).
- Cada envio também chamava `recordShipmentConsumed` sem apiKind → cobrança dupla/incorreta para Alternativa.

## Solução

- `resolveDispatchCreditsApiKindForOwner`: perfil Alternativa → bucket `alternativa`.
- **Alternativa:** débito **1 envio por mensagem enviada com sucesso** (`recordShipmentConsumed(email, 1, "alternativa")`).
- **Alternativa:** na criação da campanha só **limita** destinos ao saldo; **não debita** antecipado.
- Saldo zerado → campanha **pausa** automaticamente no tick de disparo.
- Ativação bloqueada se `remainingShipments` alternativa = 0.
- **Oficial:** mantém débito antecipado na criação; sem débito extra por envio.

## Arquivos

- `src/index.ts` — `processOneCampaignDispatch`, `POST /disparos/campanhas`, `POST .../estado`

## Validar

1. Assinante com pacote `apiKind: alternativa` e saldo N.
2. Criar campanha com N+M destinos → lista cortada em N; saldo ainda N.
3. Disparar → saldo diminui 1 por envio bem-sucedido.
4. Saldo 0 → campanha pausa.

**Palavras-chave:** `recordShipmentConsumed`, `alternativa`, `getRemainingShipmentsForApi`, débito por envio
