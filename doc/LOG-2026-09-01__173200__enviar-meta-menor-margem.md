# CTA Enviar para META 15% menor e mais margem superior

## Contexto

O botão centralizado **Enviar para META** ficou grande demais. Pedido: reduzir 15% e dar mais espaço acima.

## Solução

- Padding, fonte, largura mínima e raio reduzidos em ~15%.
- `margin-top` da barra de 22px para 38px.

## Arquivos

- `index.html`
- `src/deploy-marker.ts` — `DEPLOY-2026-09-01-173200-enviar-meta-menor`

## Como validar

Preview `/?ui-preview=template-ai`: o CTA do rodapé um pouco menor, com mais folga acima.

## Palavras-chave

Enviar para META, tamanho, margem, CTA
