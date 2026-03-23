# Exemplos — camada de integração

## Estrutura conceitual

```
core/
  ports/
    PaymentGateway.ts      # interface usada pelo domínio
integrations/
  stripe/
    StripePaymentAdapter.ts # implementa PaymentGateway; usa SDK/HTTP Stripe
```

O serviço de domínio depende apenas de `PaymentGateway`, não de Stripe.

## Pseudocódigo — chamada com retry seguro

```ts
// Apenas leitura ou operação idempotente
await withRetry(() => client.getStatus(id), {
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 5000,
  retryOn: (e) => e.code === "ETIMEDOUT" || e.status >= 500,
});
```

## Log seguro

```ts
logger.info("integration.request.completed", {
  provider: "acme-crm",
  operation: "syncContact",
  durationMs: elapsed,
  statusCode: res.status,
  correlationId,
  tenantId,
  // sem: body, authorization, email, documento
});
```
