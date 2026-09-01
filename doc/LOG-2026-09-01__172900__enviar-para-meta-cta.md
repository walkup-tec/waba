# Renomear CTA do rodapé para Enviar para META

## Contexto do pedido

O botão centralizado do rodapé ainda se chamava **Gerar**. Pedido: passar a **Enviar para META**.

## Solução

Label de `#meta-tpl-ai-submit-all` alterada. O **Gerar** da coluna Texto base (reescrever as 3 opções) permanece.

## Arquivos

- `index.html`
- `src/deploy-marker.ts` — `DEPLOY-2026-09-01-173000-enviar-para-meta`

## Como validar

Preview `/?ui-preview=template-ai`: o botão grande do centro deve ler **Enviar para META**.

## Palavras-chave

Enviar para META, submit-all, CTA template
