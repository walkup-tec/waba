# LOG: fix — feedback após “Salvar na biblioteca” + painel que não fechava

## Problema

Após gravar o produto, a UI parecia **não confirmar** o salvamento e o **painel da biblioteca continuava aberto** como se nada tivesse ocorrido.

## Causa provável

No handler do POST, após sucesso chamava-se `await loadMessengerProductsList()`. Se essa requisição (GET) **falhasse** ou desse timeout, o código caía no `catch` externo (`Erro ao salvar na biblioteca`), **sem** chamar `hideMessengerLibrarySavePanel()` — embora o POST tivesse gravado no servidor.

## Correção

- Tratar **sucesso do POST** de forma independente: mensagem de sucesso + texto de confirmação (`#dis-messenger-library-feedback`) + `setTimeout` para fechar o painel.
- `loadMessengerProductsList()` em **try/catch próprio**; falha só mostra aviso de “recarregue se a lista não atualizar”, sem invalidar a gravação.
- Toast mais explícito com o nome salvo.

## Arquivos

- `index.html`
