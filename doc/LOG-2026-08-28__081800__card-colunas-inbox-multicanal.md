# Card em colunas + Inbox multicanal

## Contexto

O card do número no Laboratório empilhava logo, telefone, nome e status à esquerda, com largura ociosa. O Inbox era uma caixa só, sem canal de origem visível.

Pedido: 6 colunas (logo, número, nome, foto, nome, Inbox) e o layout unificado do Inbox com chip de origem.

## Solução

- Card em grade horizontal: logo e nome abrem o editor; Foto/Nome mostram Atualizada(o) ou Processando; switch Inbox liga atendimento naquele `phoneNumberId`.
- Inbox desligado (explícito) some da lista; sem flag o número continua no Inbox (Mozart não some no deploy).
- Inbox unificado: faixa Todos + canais, chip `via {canal}` na lista, cabeçalho e compositor travados no canal da conversa, bolha `Bot · {canal}`.
- Resposta Graph usa o `phoneNumberId` da conversa, não o número gravado na conexão.

## Arquivos

- `index.html` / `dist/index.html`
- `src/integrations/meta-whatsapp/*` (identity, inbox, rotas, messaging)
- `src/integrations/whatsapp/meta-cloud-provider.ts`

## Como validar

- Laboratório: card em 6 colunas; switch Inbox; Ctrl+F5 após deploy.
- Inbox: filtro por canal; header `via …`; compositor sem seletor de número.
- Testes: `npm run test:meta-phase8` e `npm run test:meta-portfolio`

## Palavras-chave

meta-number-card, inboxEnabled, phoneNumberId, canal de origem, Bot · canal
