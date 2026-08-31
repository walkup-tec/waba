# LOG — fix modal PIX compra números (API Alternativa)

**Data:** 2026-06-19

## Problema
Modal de contratação abria, mas «Gerar PIX» falhava ou não abria QR.

## Causas identificadas
1. Submit podia cair no endpoint `/billing/disparos/checkout` (mínimo R$ 300) se `alternativaNumbersCheckoutActive` se perdesse — pacote R$ 20 rejeitado.
2. WhatsApp fixo/inválido → Asaas retorna «O celular informado é inválido».
3. Cancelar modal de números abria overlay de tabela de preços (fluxo créditos), confundindo estado.
4. Guest sem login só falhava no submit (401).

## Correções (`index.html`)
- `isAlternativaNumbersCheckoutContext()` — roteia por flag **ou** `disparosSelectedPackage.kind === "alternativa-numbers"`.
- `normalizeBrazilMobileWhatsappInput()` — valida celular DDD+9 antes do POST.
- `credentials: "same-origin"` nos fetch de números alternativos.
- Login obrigatório ao abrir modal de compra.
- Cancel limpa estado de números sem abrir pricing.
- `openDisparosBillingModal` reseta estado de números alternativos.

## Validação
- API local: `POST /billing/alternativa-numbers/checkout` → 201 + `pixCopyPaste` + QR.
- `npm run build` OK; `dist/index.html` sincronizado.

## Reteste
Ctrl+F5 → API Alternativa → Comprar números → Pagar com PIX → preencher **celular** (11) 98765-4321 → Gerar PIX.
