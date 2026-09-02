# LOG — Fechar do modal de templates enviados

## Contexto

Clique em **Fechar** no modal «Templates enviados à Meta» não encerrava.

## Causa

O close dependia de um listener no fim da página e recusava fechar em alguns estados. Se o overlay não estivesse aberto no JS, o card ficava na tela.

## Solução

- **Fechar** força o close (sucesso/erro), independente da fase.
- O clique também é tratado no handler da tela e no próprio overlay ao abrir.

## Como validar

Enviar as três opções, ver o modal de sucesso, clicar Fechar: some o overlay. Escape e clique no fundo também fecham.

## Palavras-chave

fechar, modal, templates enviados, overlay
