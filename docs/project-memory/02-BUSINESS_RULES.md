# Regras de negócio

- Isolamento por tenant da sessão. Cliente não escolhe `tenant_id`.
- Listagem do card de relatórios mostra **todos** os templates do tenant, sem exigir portfólio.
- Filtro de portfólio (padrão: Todos os Portfólios) e busca por nome são só de UI.
- Na tabela de templates, a única ação visível é **Visualizar**, sem efeito.
- Criação/sync de templates exige WABA connected (ou pending_confirmation) do portfólio escolhido.
- Botão URL enviado à Graph é a URL curta WABA (`/s/{slug}`), nunca `wa.me`.
- Laboratório Cloud: BODY Utility com léxico **Olá** + **Informamos que** + **Para**. Botões só **Ver Detalhes**, **Saiba Mais**, **Ver Atualizações**. A categoria final é da Meta.
