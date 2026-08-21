# LOG — UI Restrição: fonte, ícone e capitalização

## Contexto do pedido

Melhorar o indicador visual de status **Restrição** na lista de instâncias: aumentar ícone e fonte e exibir o texto como **"Restrição"** (não "restrição").

## Causa

`.status-text { text-transform: lowercase; }` forçava o rótulo para minúsculas mesmo com o HTML já contendo `Restrição`. Ícone e tipografia herdavam o tamanho padrão pequeno da célula.

## Solução

Em `index.html` e `dist/index.html`:

- `.status-text.wa-restriction`: `text-transform: none`, `font-size: 1.05rem`, `font-weight: 800`
- Ícone WA em restrição: `1.35em` (antes `0.95em`)
- Alinhamento flex do ícone + texto

## Arquivos

- `index.html`
- `dist/index.html`

## Como validar

Abrir aba Instâncias com uma linha em restrição: deve aparecer **Restrição** (R maiúsculo), ícone e texto maiores que os outros status em lowercase.

## Observações

Mudança só de CSS/UI; não altera lógica de detecção de `connecting`.

## Palavras-chave

`restricao`, `wa-restriction`, `status-wa-icon`, `text-transform`, `UI instancias`
