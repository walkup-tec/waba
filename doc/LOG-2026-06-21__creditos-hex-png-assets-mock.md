# LOG — Hexágonos PNG na tela Contratar

## Contexto

Usuário enviou 3 PNGs separados (Pacotes, API Oficial com WhatsApp, API Alternativa com robô) para substituir hexágonos CSS e reproduzir a disposição do mock original.

## Solução

- Assets em `media/`:
  - `disparos-hex-pacotes-servicos.png`
  - `disparos-hex-api-oficial.png`
  - `disparos-hex-api-alternativa.png`
- HTML: `<img class="disparos-hex-art">` no cluster (badges já embutidos nos PNGs).
- CSS: posicionamento absoluto — intro à esquerda (centro vertical), oficial topo-direita, alternativa baixo-direita, sobrepostos.
- Removidos estilos `disparos-api-hex` do cluster.

## Validar

Créditos → Contratar: artes 3D alinhadas ao mock; fundo preto das PNGs funde com `#0b111b`.

## Palavras-chave

`disparos-hex-art`, `disparos-hex-api-oficial`, PNG hex cluster
