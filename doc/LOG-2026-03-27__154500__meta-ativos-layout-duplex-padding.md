# LOG: API Meta Ativos — layout duas colunas e padding

## Contexto

Reduzir padding superior do painel **API Meta - Ativos** e organizar em **esquerda (ações)** / **direita (listagens)**, no estilo do dashboard (Visão Geral 8/4).

## Implementação

1. **CSS** (`index.html`): classe `.meta-ativos-main-panel` com padding menor que o `.panel` global; `.meta-ativos-duplex` com grid 1fr/1fr a partir de `992px`; `.meta-ativos-side` para caixas da direita; em `max-width: 900px` padding ainda mais compacto no painel Meta Ativos.
2. **HTML**: três blocos `row meta-ativos-duplex`:
   - **1)** texto “Criação de App” × coluna **Apps criados** + `#meta-apps-list` + `#meta-refresh-apps-btn`.
   - **2)** formulário etapa 2 (sem botão “Ver apps inscritos”) × **Chave API integrada** `#meta-integration-key-list`.
   - **3)** etapa 3 renomeada para **Integrar números WhatsApp** × **Números integrados** `#meta-phone-list` (antes abaixo da etapa 2).
3. **JS**: `renderMetaSubscribedAppsList`, `renderMetaIntegrationKeySummary`, `fetchAndRenderMetaSubscribedApps` (após `metaPost`); botão `meta-refresh-apps-btn`; etapa 2 automática preenche lista de apps; após `subscribed_apps/ensure` atualiza lista de apps em silêncio; `syncMetaCredentialsChecklist` também chama `renderMetaIntegrationKeySummary`.

## Arquivos

- `index.html`, `dist/index.html` (build)
- `doc/memoria.md`, este LOG

## Validação

- Desktop largo: duas colunas alinhadas por linha.
- Mobile: colunas empilham (`col-12`).
- Token exibido apenas mascarado (últimos 4 caracteres quando comprimento > 4).

## Palavras-chave

`meta-ativos-duplex`, `meta-refresh-apps-btn`, `meta-apps-list`, `meta-integration-key-list`
