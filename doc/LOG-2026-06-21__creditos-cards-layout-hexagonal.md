# Créditos — cards de compra layout hexagonal

## Contexto

Pedido do usuário: reformular os cards de contratação de créditos no estilo da referência (hexágonos + features + preço/CTA), mantendo informações atuais (prévia, preços, mínimo R$ 300, botões Contratar).

## Solução (UX/UI)

Layout em 3 zonas por plano:
1. **Hexágono** — nome da API + ícone (verde Oficial / azul Alternativa)
2. **Corpo** — prévia da mensagem + lista de recursos com checkmarks
3. **Investimento** — faixa de preço, CTA e mínimo

Intro central «Nossos planos» em hexágono claro. Grid responsivo: desktop horizontal com conectores; mobile empilhado.

## Arquivos

- `index.html`, `dist/index.html`

## Validação

- Aba Créditos → Contratar: 2 planos em layout hex
- Clique Contratar abre modal de preços (oficial/alternativa)
- Modal recompra clona o mesmo `#disparos-purchase-choice-wrap`
- Mobile < 900px: hex + conteúdo empilhados

## Palavras-chave

`disparos-api-hex`, `disparos-choice-grid`, cards créditos hexagonal
