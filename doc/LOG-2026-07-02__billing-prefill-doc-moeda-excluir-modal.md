# LOG — Billing prefill doc, moeda milheiro, modal excluir assinante

**Data:** 2026-07-02  
**Marker:** `DEPLOY-2026-07-02-billing-prefill-doc-moeda-milheiro`

## Alterações

1. **Checkout PIX** — CPF/CNPJ preenchido do cadastro (`session.subscriber.cpfCnpj`); máscaras CPF e WhatsApp no formulário.
2. **Moeda** — `formatDisparosMoneyDecimal` com `toLocaleString("pt-BR")` → `R$ 100.000,00`.
3. **Admin assinantes** — confirmação de exclusão em modal customizado (sem `window.confirm`).

## Arquivos

- `index.html`
- `src/subscribers/waba-subscriber.service.ts`
- `src/deploy-marker.ts`
- `dist/`

## Validar

- Login assinante → Contratar → CPF preenchido e valor com milheiro.
- Admin → Excluir assinante → modal estilizado.

## Palavras-chave

`prefillDisparosBillingForm`, `formatDisparosMoneyDecimal`, `admin-subscriber-delete-overlay`
