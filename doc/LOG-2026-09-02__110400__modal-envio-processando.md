# LOG — Processando do Enviar para META não aparecia

## Contexto

Em produção o modal pulava a etapa 3 (spinner, barra e lista de opções) depois do Enviar interno.

## Causa

Produção (`deployMarker` `DEPLOY-2026-09-02-103000-modal-excluir-template`) já tinha o JS de processar. O clique em **Enviar** disparava o mesmo handler 2–3 vezes. O primeiro `resolve(true)` agendava `showProcessing`; o checkpoint de microtask do browser rodava isso **antes** do próximo listener. O listener seguinte via fase `processing` e chamava `metaTplAiCloseOverlay(true)`, fechando o overlay antes do paint. O resultado reabria o modal no fim.

## Correção

- `OnModalOk` ignora clique extra enquanto processa.
- `CloseOverlay` não fecha na fase `processing` (nem com `force`).
- Fundo do overlay não usa mais close forçado.
- Dois `requestAnimationFrame` antes do upload/submit para o gráfico pintar.

## Como validar

Após Redeploy: Enviar para META → Enviar no modal → o overlay permanece com spinner e etapas até a Graph responder.

Marker: `DEPLOY-2026-09-02-110400-modal-envio-processando`

## Palavras-chave

modal, processando, Enviar para META, microtask, listener duplicado, overlay
