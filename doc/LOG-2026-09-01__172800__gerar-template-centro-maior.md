# Botão Gerar do rodapé maior e centralizado

## Contexto do pedido

O **Gerar** que envia as 3 opções à Meta estava pequeno e alinhado à esquerda. Pedido: maior e bem ao centro da tela.

## Solução implementada

- Barra `.meta-tpl-ai-submit-bar` com conteúdo centralizado.
- Botão `#meta-tpl-ai-submit-all` com padding e fonte maiores.
- Texto de ajuda também centralizado. No mobile o botão ocupa até 320px.

O **Gerar** da coluna Texto base (gerar as 3 opções) não mudou.

## Arquivos

- `index.html`
- `src/deploy-marker.ts` — `DEPLOY-2026-09-01-173000-gerar-centro-maior`

## Como validar

Preview: `/?ui-preview=template-ai` — o Gerar do rodapé deve estar maior e no centro.

## Palavras-chave

Gerar, CTA, centralizar, submit-all, template IA
