# Cabeçalho editável e botão de arquivo no layout do sistema

## Contexto

O campo **Cabeçalho** não aceitava digitação (era `disabled` quando a mídia não era Nenhuma). O `<input type="file">` nativo ficava cinza, fora do layout.

## Solução

- Cabeçalho permanece sempre editável.
- Arquivo: botão `Escolher arquivo` no estilo do sistema + nome do arquivo ao lado.

A Meta ainda aceita um só HEADER: com imagem/vídeo/documento o arquivo prevalece; com mídia Nenhuma, vai o texto.

## Arquivos

- `index.html`
- Marker: `DEPLOY-2026-09-01-181200-header-editavel-arquivo`

## Palavras-chave

cabeçalho, disabled, file input, escolher arquivo, layout
