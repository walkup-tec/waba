# Inbox: nome do chip + botão Todos

## Contexto do pedido

Ao atualizar o nome de uma conta WhatsApp no Laboratório, o Inbox continuava com o nome antigo (ex.: razão social Graph). O botão **Todos**, à esquerda do card do número, ficava espremido e o texto «Todos os canais» aparecia cortado («Todos os car»).

## Ações executadas

- Investigação: canais do Inbox vêm de `listPhoneInboxChannels` (`channelName` congelado no toggle), não do nome recém-salvo.
- CSS: `.meta-chat-channel` usava coluna de foto `28px` mesmo no botão **Todos**, que não tem avatar.

## Solução implementada

1. Ao salvar o perfil do chip, grava também `channelName` com o nome pedido.
2. O rótulo do Inbox prefere `identity.name` (nome salvo) a um `channelName` antigo.
3. Religar o switch não sobrescreve o nome já salvo no chip.
4. Após salvar o perfil, a UI recarrega o Inbox sem F5.
5. Barra de canais em coluna (largura total da lista). **Todos** sem coluna de foto; nomes longos com reticências.

## Arquivos criados/alterados

- `src/integrations/meta-whatsapp/meta-whatsapp-phone-identity.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- `src/deploy-marker.ts`
- `index.html`
- `doc/memoria.md`
- `.cursor/project-memory/02-BUSINESS_RULES.md`
- `.cursor/project-memory/05-DECISIONS.md`
- `.cursor/project-memory/06-CURRENT_STATUS.md`

## Como validar

- `npm run test:meta-portfolio`
- `npm run test:meta-phase8`
- Laboratório: salvar nome do chip → Inbox deve mostrar o mesmo nome no banner e no card do canal.
- Inbox: **Todos os canais** legível, sem sobrepor o card do número.

## Observações de segurança

- Sem tokens ou segredos novos.

## Palavras-chave

inbox, channelName, display name, Todos, responsividade, Laboratório
