# LOG: Checklist API Meta em dock flutuante (mobile-first)

## Contexto (resumo)

O checklist de validação guiada da API Meta ocupava muito espaço no painel **Ativos**. Foi pedido título **API Meta - Ativos**, checklist **compacto, flutuante e recolhível**, pensando em **mobile first**.

## Ações executadas

1. Título do painel em `tab-meta-ativos`: **API Meta - Ativos** (removido o texto longo “Fase 1 · Criação de Ativos”).
2. Removido o bloco inline `.meta-guide` de dentro do painel.
3. Incluído `#meta-guide-dock` após `</main>` (dentro de `.shell`): painel com lista + botão tipo chip “Checklist API Meta” com contador **x/6**.
4. CSS: dock `position: fixed`, `z-index: 1150`, lista em coluna única compacta; em `max-width: 640px` estica entre margens com `safe-area`.
5. JS: visibilidade do dock ligada a `isOfficialTab(nextTab)` dentro de `setActiveTab`; estado recolhido em `localStorage` (`waba.meta.guide.dockCollapsed`, padrão recolhido); toggle, botão fechar e `Escape` para recolher; `renderMetaGuideChecklist` atualiza o contador.

## Arquivos alterados

- `index.html` — título, markup do dock, estilos, lógica JS.
- `dist/index.html` — atualizado via `npm run build` (`scripts/copy-index-html.mjs`).
- `doc/memoria.md` — resumo e palavras-chave.
- `doc/LOG-2026-03-27__151200__meta-checklist-dock-flutuante-mobile.md` — este arquivo.

## Como validar

1. `npm run build` (já executado nesta tarefa).
2. Abrir app, ir a **API Meta** → **1) Ativos API**: não deve haver grade larga de checklist no topo do painel.
3. Deve aparecer o chip inferior **Checklist API Meta · x/6**; ao clicar, expandir a lista; fechar com **×**, clicando de novo no chip ou **Escape**.
4. Alternar para **Templates** ou **Disparo API**: o dock continua disponível.
5. Em viewport estreita (~mobile): chip deve usar largura entre as margens com área segura.

## Segurança

- Nenhum segredo alterado; apenas UI e `localStorage` para preferência de UI e estado do checklist (já existente).

## Palavras-chave (busca futura)

`meta-guide-dock`, `waba.meta.guide.dockCollapsed`, checklist-flutuante, api-meta-ativos, mobile-first
