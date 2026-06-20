# Pacote teste Disparos — 100 envios · R$ 1,00

**Data:** 2026-06-08  
**Pedido:** pacote de teste para pagamento real em ambas categorias (API Oficial e Alternativa).

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `index.html` | Tier `{ shipments: 100, pricePerSend: 0.01, totalCents: 100, testOnly: true }` no início de `DISPAROS_PRICING_TIERS.oficial` e `.alternativa`; coluna total com prefixo 🧪 |
| `src/billing/waba-billing.service.ts` | `DISPAROS_TEST_PACKAGE_CENTS = 100`; validação permite R$ 1,00 quando `shipmentCount === 100` |

## Como testar

1. `npm run dev:v02` → `http://localhost:3012/version-02/`
2. Disparos → Contratar (Oficial ou Alternativa)
3. Selecionar linha **100 envios · R$ 1,00** (🧪)
4. Continuar → formulário → Gerar PIX → pagar no app do banco

## Pendências

- Commit/deploy em `master` quando usuário pedir
- Remover ou desativar tier de teste após validação em produção
