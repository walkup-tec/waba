# LOG — Mínimo de crédito API Alternativa R$ 200

## Contexto do pedido
Para API Alternativa o crédito mínimo é R$ 200,00 (não R$ 300,00). Alterar a regra, commit e push.

## Causa
`validateCheckoutInput` usava um único mínimo global (`WABA_DISPAROS_MIN_CREDIT_CENTS`, padrão 30000). O pacote de 1.000 envios da Alternativa vale R$ 200 e era rejeitado com “Valor mínimo de créditos: R$ 300,00”. A UI já mostrava R$ 200.

## Solução
- Mínimo por `apiKind`: Alternativa R$ 200; Oficial permanece R$ 300.
- Env opcional `WABA_DISPAROS_MIN_CREDIT_CENTS_ALTERNATIVA` (padrão 20000).
- `getDisparosConfig` passa a expor também `minCreditCentsAlternativa`.

## Arquivos
- `src/billing/waba-billing.service.ts`
- `src/deploy-marker.ts`
- `.env.example` / `.env.v02.example`
- `dist/billing/waba-billing.service.js` (build)

## Marker
`DEPLOY-2026-08-14-min-credito-alternativa-200`

## Como validar
- Checkout Alternativa 1.000 envios (R$ 200) não deve retornar erro de mínimo.
- Oficial continua exigindo mínimo R$ 300.
- Após redeploy: `GET /health` com o marker acima.

## Palavras-chave
minimo credito, alternativa, 200, checkout pix, WABA_DISPAROS_MIN_CREDIT_CENTS_ALTERNATIVA
