# Remover Teste de envio Cloud API

## Contexto

A ferramenta textual de teste no Laboratório não é requisito da Meta e o usuário
solicitou sua exclusão do sistema.

## Solução

- Removido o painel “Teste de envio Cloud API”.
- Removidos seletor de origem, destino, mensagem, resultado e JavaScript associado.
- Mantida a rota de mensagens porque também atende o teste de templates e outros
  fluxos internos; o envio operacional continua exclusivamente no Atendimento.

## Arquivos

- `index.html`
- `dist/index.html`
- `src/deploy-marker.ts`
- `dist/deploy-marker.js`

## Validação

- Buscar por `meta-cloud-lab` e `wabaSendMetaCloudLabTest`: zero ocorrências.
- Build TypeScript e testes do Inbox.

## Segurança

A remoção reduz a superfície de envio textual manual sem afetar autenticação,
tokens ou webhooks.

## Palavras-chave

Meta Cloud API, teste de envio, remover painel, Laboratório
