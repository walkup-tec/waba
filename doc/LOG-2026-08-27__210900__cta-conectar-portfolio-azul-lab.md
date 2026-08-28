# CTA Conectar Portfólio — alinhado à esquerda e azul do Laboratório

## Contexto do pedido

No CARD 01 (Etapas de integração), o texto à esquerda (“Conectar WhatsApp” + parágrafo do portfólio Drax) ocupava espaço e o bloco ficava recuado (`.meta-onboard` com `max-width: 920px` e `margin: 0 auto`). O botão era verde WhatsApp com o rótulo “Conectar WhatsApp”.

## Ações executadas

- Removido o título e o parágrafo do hero.
- Botão alinhado à esquerda (`justify-content: flex-start`; `.meta-onboard` sem caixa centralizada).
- Rótulo: logo Meta (`/media/meta-logo.png`) + “Conectar Portfólio”.
- Cor do botão: a mesma do toggle Laboratório (`rgba(15, 40, 80, 0.9)` / `#93c5fd` / borda `rgba(59, 130, 246, 0.9)`).
- Hint da etapa 1: “Clique em Conectar Portfólio”.
- `node scripts/copy-index-html.mjs` para espelhar em `dist/index.html`.

## Arquivos alterados

- `index.html` (CSS + markup do hero)
- `dist/index.html` (cópia)

## Como validar

Abrir Laboratório → WhatsApp Oficial (Mozart). O CARD 01 deve mostrar só o botão azul à esquerda, com logo Meta e o texto “Conectar Portfólio”. Os botões verdes (Adicionar número, Editar, Salvar) não mudam.

## Observações

Sem commit/push neste passo. Produção só muda após deploy do HTML.

## Palavras-chave

conectar-portfolio, meta-logo, laboratorio-azul, meta-onboard-hero, cta-portfolio
