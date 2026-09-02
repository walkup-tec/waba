# LOG — Modal Visualizar template

## Contexto

O botão **Visualizar** da tabela deve abrir um modal com a montagem do template, no formato do print (título **Seu modelo**, fundo de conversa, bolha, cabeçalho, corpo, horário e botão verde).

## Ações

- Overlay `#meta-tpl-preview-overlay`.
- Monta HEADER (texto ou placeholder de mídia), BODY (substitui `{{n}}` pelos exemplos) e BUTTONS.
- Fecha com Fechar, clique fora e Escape.
- Usar em teste e Excluir não mudam.

## Como validar

Clicar Visualizar numa linha com corpo e botão URL. Conferir título, texto e rótulo do botão. Sem mídia pública, o cabeçalho de imagem aparece como placeholder.

## Palavras-chave

visualizar, modal, seu modelo, whatsapp preview
