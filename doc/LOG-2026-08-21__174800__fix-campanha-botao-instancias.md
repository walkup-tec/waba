# LOG — «+ Instâncias» na campanha não fazia nada

## Contexto do pedido

Campanha **Seguradoras**: pill **9224** vermelha, **walkup-5401** verde, aviso para usar «+ Instâncias». O clique no botão não abria troca nem toast.

## Sintoma vs esperado

- Esperado: ao clicar, trocar o número desconectado por um conectado (Proxy segue o novo chip) e dar feedback.
- Ocorrido: clique sem reação visível.

## Causa raiz

1. **UI (alta confiança):** «Pausar» já usa `pointerdown` (capture) porque o 1º `click` some com blur/re-render da lista. «+ Instâncias» ainda usava só `click`, sem toast de início e sem `catch` se o `fetch` estourasse timeout.
2. **API (alta confiança):** `POST /disparos/campanhas/:id/instancias` calculava saúde só com `fetchInstances`/cache, sem `connectionState` live. A lista GET já marca 9224 vermelho; o POST podia achar que o mínimo já estava ok (`400` «já possui números suficientes») ou não ver o offline para a troca 1:1.

## Solução

- Mesmo padrão do Pausar: `pointerdown` + botão «Trocando…» + toast imediato + `catch` de timeout.
- POST: probe `connectionState` dos nomes da campanha; `instancesToAdd` inclui todos os desconectados (não só o mínimo); 409 explica qual chip não tem substituto.

## Arquivos

- `index.html`
- `src/index.ts`

## Como validar

1. Em Campanhas, com um pill vermelho, clicar **+ Instâncias**.
2. Deve aparecer toast «Procurando número…» e o botão «Trocando…».
3. Se houver chip conectado livre: 9224 sai, entra o novo, toast de sucesso.
4. Se não houver substituto: toast avisando o nome offline (não silêncio).

Ainda depende de HTML no ar (FTP) e Node com o POST novo (Redeploy `waba_disparador`).

## Segurança

Sem segredos. Sem `sendText`.

## Palavras-chave

`+ Instâncias`, `btn-campaign-add-instances`, `pointerdown`, `POST /disparos/campanhas/:id/instancias`, `connectionState`, Seguradoras, 9224
