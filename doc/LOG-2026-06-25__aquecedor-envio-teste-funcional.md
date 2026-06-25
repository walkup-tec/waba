# LOG — Envio teste Aquecedor funcional

## Contexto

Botão **Envio teste** só revelava **Iniciar Aquecedor** em vez de enviar mensagem entre duas instâncias ativas.

## Causa

- UI: `aquecedorStartUnlocked` escondia o motor até clicar em Envio teste.
- Backend: cooldown `nextAllowedAt` bloqueava `forceTest`; turno do par impedia pick no teste.

## Solução

- Motor visível ao abrir a aba (sem unlock via teste).
- `run-once`: bypass cooldown em teste; fallback para primeiro par conectado; resposta com `lastResult` e `ok`.
- UI: feedback "Enviando teste...", toast com resultado, atualiza hero e lista de envios.

## Arquivos

- `src/index.ts`, `index.html`, `dist/`

## Palavras-chave

`aquecedor/run-once`, `runAquecedorCycleTestBatch`, `Envio teste`
