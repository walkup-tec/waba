# LOG — Modal de exclusão de template (confirmação + processando)

## Contexto do pedido

O botão **Excluir** da tabela de templates usava `window.confirm` do navegador. O usuário pediu confirmação estilizada em modal do sistema e um gráfico de processando até a exclusão na Meta terminar (a Graph demora alguns segundos).

## Ações executadas

- Overlay `#meta-tpl-delete-overlay` no mesmo padrão visual dos outros `confirm-overlay` do painel.
- Fluxo: confirmação (nome + aviso de 30 dias + Cancelar/Excluir) → processando (spinner, título pulsando, barra indeterminada; clique fora e Escape bloqueados) → sucesso fecha o modal e atualiza a tabela, ou erro com Fechar.
- O `window.confirm` do reset do laboratório oficial (`metaTpResetOfficialLab`) não foi alterado.

## Arquivos criados/alterados

- `index.html` — CSS, markup e JS do modal
- `src/deploy-marker.ts`
- `docs/project-memory/02-BUSINESS_RULES.md`, `06-CURRENT_STATUS.md`
- `doc/memoria.md`

## Como validar

1. No painel logado, Templates WhatsApp → Excluir: deve abrir o modal escuro, não o diálogo nativo do browser.
2. Confirmar: o modal permanece com spinner até a lista atualizar.
3. Cancelar / Escape / clique no fundo: fecha só na etapa de confirmação.
4. Falha da Graph: o mesmo modal mostra o erro e Fechar.

Marker: `DEPLOY-2026-09-02-103000-modal-excluir-template`

## Observações de segurança

Sem segredos. DELETE continua autenticado no mesmo endpoint tenant-isolado.

## Palavras-chave

modal, excluir, template, confirm, processando, spinner, Meta Graph, window.confirm
