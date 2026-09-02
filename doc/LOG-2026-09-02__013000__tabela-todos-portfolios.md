# LOG — Tabela de templates: todos os portfólios

## Contexto do pedido

No card **Templates WhatsApp** (laboratório Meta), a lista só carregava depois de escolher um portfólio no formulário de criação. O pedido foi:

- exibir templates de **todos** os portfólios na mesma tabela;
- select de filtro com primeira opção **Todos os Portfólios**;
- campo de pesquisa por **Nome** (atualiza a tabela ao digitar);
- botão **Excluir** só no front, sem chamar a Meta.

## Ações executadas

- `GET /integrations/meta/whatsapp/templates` sem `connectionId` passa a listar o tenant inteiro (`listByTenant`), ainda isolado por `tenant_id`.
- Com `connectionId` (criação/sync), o recorte por WABA continua.
- Sem WABA connected, a listagem geral devolve `[]` em vez de `not_connected`.
- Front: filtros de portfólio/nome/status; exclusão persistida em `sessionStorage` (`waba-meta-tpl-lab-hidden`).
- Sync **Atualizar da Meta**: todos os portfólios, ou só o filtrado, depois recarrega a lista unificada.

## Solução

1. `MetaWhatsappTemplateRepository.listByTenant(tenantId)`.
2. `listFromAuth` sem query lista todas as linhas do tenant e preenche `portfolioName` via `listOpenByTenant`.
3. Toolbar do card: `#meta-tpl-lab-portfolio-filter` e `#meta-tpl-lab-name-filter`.
4. `metaTplLabRenderTable` aplica os três filtros + IDs ocultos sem zerar o cache.
5. `data-meta-tpl-hide` remove só da UI.

## Arquivos criados/alterados

- `src/integrations/meta-whatsapp/meta-whatsapp-template.repository.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-phase7.test.ts`
- `src/deploy-marker.ts`
- `index.html`
- `doc/memoria.md`
- `docs/project-memory/` (base permanente criada nesta tarefa)

## Como validar

```bash
npm run test:meta-phase7
```

Funcional (após login no laboratório):

- abrir o card sem escolher portfólio no formulário de criação → tabela com todos;
- filtro **Todos os Portfólios** / um portfólio;
- digitar no campo de nome → a tabela reduz;
- **Excluir** some a linha; Recarregar/Atualizar da Meta não a traz de volta na mesma sessão;
- a Meta não recebe DELETE.

## Observações de segurança

- Listagem continua autenticada e filtrada por `tenant_id`.
- Excluir no front não apaga Graph nem banco.
- Hidden IDs ficam só no `sessionStorage` do navegador.

## Palavras-chave (evitar duplicação)

`templates`, `portfólio`, `filtro`, `nome`, `excluir front`, `sessionStorage`, `listByTenant`, `Todos os Portfólios`
