# Referência — integrações resilientes

## Checklist rápido

- [ ] Contrato interno (interface) separado do cliente HTTP/SDK
- [ ] Timeouts e limites de payload
- [ ] Retry apenas em erros idempotentes ou com idempotency key
- [ ] Logs estruturados sem dados sensíveis
- [ ] Métricas: latência, taxa de erro, taxa de retry
- [ ] Testes: mock do adapter; contrato estável para o domínio

## Retry

- **Retentar**: timeouts, conexão resetada, 502/503/504 (com cuidado).
- **Não retentar** (ou tratar à parte): 401/403, 400 de validação, violação de negócio.
- Usar **idempotency key** em POST que criam recursos no provedor.

## Circuit breaker (quando)

- Provedor instável ou latência alta recorrente.
- Abrir após N falhas; half-open após cooldown; fechar ao recuperar.

## Webhooks (recebidos)

- Validar assinatura do provedor.
- Responder rápido (202) e processar em fila/worker quando o trabalho for pesado.
- Dedupe por `event_id` quando o provedor reenviar eventos.

## Multi-tenant

- Isolar credenciais e configuração por `tenant_id` quando cada cliente tiver sua própria conta no provedor.
