# LOG — Modal Enviar templates voltou ao centro

## Contexto

O modal **Enviar templates à Meta** aparecia no rodapé, no fluxo da página, sem overlay.

## Causa

Ao inserir `#meta-tpl-preview-overlay`, o wrapper `#meta-tpl-ai-overlay.confirm-overlay` foi perdido. O `.confirm-modal` ficou solto. O JS procura o overlay, não acha e não aplica `position: fixed`.

## Solução

Restaurou `<div id="meta-tpl-ai-overlay" class="confirm-overlay">` em volta do modal. Com `.open` volta a ser overlay centralizado (mesmo padrão dos outros confirms).

## Como validar

Clicar **Enviar para META**: o card deve ficar no centro com fundo escuro. Cancelar / Escape / clique fora fecha.

## Palavras-chave

modal, overlay, rodapé, meta-tpl-ai-overlay, Enviar templates
