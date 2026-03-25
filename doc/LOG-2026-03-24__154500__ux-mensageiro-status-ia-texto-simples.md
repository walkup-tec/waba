# LOG: legenda IA — só “Mensagem gerada com sucesso”

## Pedido

Remover modelo, latência e URL do texto em `#dis-ai-test-status` após gerar mensagem teste.

## Alteração

- `testDisparosAiGeneration`: `statusEl.textContent` fixo em `Mensagem gerada com sucesso` (cor de sucesso mantida).

## Arquivo

- `index.html`
