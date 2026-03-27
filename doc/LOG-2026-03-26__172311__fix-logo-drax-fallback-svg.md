## Contexto do pedido

`Logo Drax` não estava renderizando no UI.

## Acoes executadas

1. Identifiquei que a imagem do logo estava apontando para um recurso externo:
   - `https://draxsistemas.com.br/assets/media/Drax-logo-footer.png`
2. Adicionei fallback local para quando a imagem externa falhar (ex.: bloqueio/rede):
   - Em `onerror`, substitui o `src` por um SVG inline via `data:image/svg+xml;utf8,...`.
3. Atualizei o `dist/index.html` via `npm run build` para que a alteração apareça no servidor.

## Arquivos alterados

- `index.html` (fallback no logo)
- `dist/index.html` (gerado via build)
- `doc/memoria.md` (atualizado)
- `doc/LOG-2026-03-26__172311__fix-logo-drax-fallback-svg.md` (novo)

## Como validar

1. Recarregar a tela do Disparador no navegador.
2. Se o carregamento remoto falhar, deve aparecer um placeholder SVG com `DRAX`.

## Observacoes de seguranca

- Nenhuma credencial foi alterada.
- Fallback não faz chamadas externas.

## Palavras-chave

- logo-drax
- fallback-svg
- onerror
