# Fix: modal PIX fecha ao gerar cobrança

**Data:** 2026-06-10

## Sintoma
Ao clicar **Gerar PIX**, o modal PIX abria e fechava na hora.

## Causa raiz
1. **Asaas** rejeita cobranças abaixo de **R$ 5,00** (`O valor da cobrança ... não pode ser menor que R$ 5,00`).
2. Pacote de teste estava em **R$ 1,00** → checkout retornava 400.
3. Frontend abria o modal PIX antes da API responder e **fechava no erro** → efeito de “piscar”.

## Correções
- Pacote teste: **100 envios · R$ 5,00** (`totalCents: 500`) em oficial e alternativa.
- Backend: `DISPAROS_TEST_PACKAGE_CENTS = 500`.
- UX: loading no formulário (**Gerando PIX…**); modal PIX só abre após sucesso; erro fica no toast sem fechar etapa.

## Validação
`POST /version-02/billing/disparos/checkout` com `valueCents:500` → 201 + QR PIX.
