# LOG — Modal de processamento no envio à Meta

## Contexto do pedido

Ao clicar em Enviar para META, o feedback era só o texto «Enviando os três templates para a Meta…» abaixo do botão. O usuário queria o modelo anterior: modal com o que está processando e efeito gráfico.

## Solução implementada

- O texto solto sob o botão some durante o envio (`#meta-tpl-ai-submit-status` fica oculto).
- O overlay existente mostra logo Meta, spinner, barra indeterminada e a lista das etapas: upload de mídia (se houver) e as três opções (título + nome).
- A etapa atual gira com um marcador animado («processando agora» / «na fila» / «concluído»).
- Clique no fundo não fecha o modal enquanto processa.

## Arquivos

- `index.html`
- `src/deploy-marker.ts`
- `docs/project-memory/06-CURRENT_STATUS.md`
- `doc/memoria.md`

## Como validar

No laboratório: Gerar as 3 opções → Enviar para META → Enviar. Deve abrir o modal no centro com spinner e as três etapas, sem a frase solta sob o botão.

Preview local: `/?ui-preview=template-ai`

## Palavras-chave

modal, processando, spinner, Enviar para META, etapas, progresso
