# Créditos — remover saldo dos cards de compra

## Contexto

Usuário pediu remover «Seu saldo: X disponíveis» dos cards API Oficial / Alternativa na aba **Contratar** (hub Créditos). Saldo permanece na aba **Histórico**.

## Alterações

- Removidos elementos `#disparos-api-balance-oficial` e `#disparos-api-balance-alternativa` do HTML.
- Removida função `renderDisparosApiCardBalances` e chamada em `renderDisparosCreditsPanel`.
- Removido CSS `.disparos-api-balance`.

## Arquivos

- `index.html`
- `dist/index.html` (build)

## Validação

Aba Créditos → Contratar: cards sem faixa de saldo; Histórico continua com split por API.
