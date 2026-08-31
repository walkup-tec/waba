# LOG — Tarifador: opção "Nenhum desses" + quantidade customizada

**Data:** 2026-07-02  
**Marker:** `DEPLOY-2026-07-02-tarifador-nenhum-desses-custom`

## Contexto

Nos tarifadores (API Oficial e API Alternativa), o assinante precisava de uma opção **"Nenhum desses"** para informar quantidade acima da última faixa da tabela. Também faltava o prefixo **R$** na coluna "Valor por envio".

## Regras de negócio

- Opção **"Nenhum desses"** na última linha da tabela de preços (ambos os tarifadores).
- Ao selecionar, exibe input de quantidade.
- Quantidade deve ser **maior que** a última faixa (ex.: > 30.000 envios).
- Total = quantidade × valor por envio da **última linha** (ex.: R$ 0,25 oficial / R$ 0,13 alternativa).
- Checkout PIX e validação de cupom aceitam pacote custom no backend.

## Alterações

### Frontend (`index.html`)

- Coluna "Valor por envio" com `formatDisparosUnitPrice` (`R$ 0,25`).
- Linha **Nenhum desses** + bloco `#disparos-pricing-custom-wrap` com input e hints.
- Funções: `buildDisparosCustomTier`, `selectDisparosPricingCustomMode`, `refreshDisparosCustomPricingSelection`.
- CSS para bloco custom e linha especial.

### Backend (`src/billing/waba-billing.service.ts`)

- `resolveDisparosCustomListValueCents` — calcula total para qty > último tier de venda.
- `resolveListValueCentsForPackage` passa a resolver pacotes custom.
- Mensagem de erro orientando quantidade mínima quando inválida.

## Arquivos alterados

- `index.html`
- `src/billing/waba-billing.service.ts`
- `src/deploy-marker.ts`

## Como validar

1. Disparos → Contratar (Oficial ou Alternativa).
2. Selecionar faixa fixa — total e R$ por envio corretos.
3. Selecionar **Nenhum desses** — input aparece.
4. Informar qty ≤ 30.000 — erro e botão Continuar desabilitado.
5. Informar qty > 30.000 — total = qty × último preço unitário.
6. Continuar → checkout PIX com qty e valor corretos.
7. Cupom (se aplicável) valida com qty custom.

## Palavras-chave

`Nenhum desses`, `disparos-pricing-custom`, `buildDisparosCustomTier`, `resolveDisparosCustomListValueCents`, `formatDisparosUnitPrice`
