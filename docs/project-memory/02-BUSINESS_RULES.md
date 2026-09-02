# Regras de negócio

- Isolamento por tenant da sessão. Cliente não escolhe `tenant_id`.
- Listagem do card de relatórios mostra **todos** os templates do tenant, sem exigir portfólio.
- Filtro de portfólio (padrão: Todos os Portfólios) e busca por nome são só de UI.
- Na tabela de templates: **Visualizar** abre o modal **Seu modelo**. **Excluir** apaga na Graph (`DELETE /{waba}/message_templates` com `hsm_id`+`name`) e no banco do tenant. Nome aprovado fica bloqueado 30 dias na Meta.
- **Atualizar da Meta** replica a biblioteca Graph do portfólio: upsert do que existe e apaga o local que a Meta já não lista. Listagem truncada não apaga.
- Criação/sync de templates exige WABA connected (ou pending_confirmation) do portfólio escolhido.
- Botão URL enviado à Graph é a URL curta WABA (`/s/{slug}`), nunca `wa.me`.
- Laboratório Cloud: BODY Utility com léxico **Olá** + **Informamos que** + **Para**. Botões só **Ver Detalhes**, **Saiba Mais**, **Ver Atualizações**. A categoria final é da Meta.
- A cada geração, a IA consulta só templates do mesmo tenant aprovados como UTILITY. Não usa Marketing, pendentes nem de outro tenant.
- A IA adapta o formato da biblioteca Utility da Meta (prints) sem trocar o tema do texto base.
