# Decisões

- 2026-09-02: submit-all só trata como já enviado se o template ainda existe no banco do portfólio. Motivo: após exclusão na Meta o modal fingia sucesso sem POST Graph.
- 2026-09-02: o painel Visualizar / usar em teste e o botão Usar em teste saíram. Motivo: Visualizar já é o modal Seu modelo; o card era laboratório órfão.
- 2026-09-02: sync completo pruneia o local que a GET `message_templates` já não devolve. Motivo: exclusão no WhatsApp Manager deixava órfãos na tabela. Não prune se a paginação Graph for truncada.
- 2026-09-02: Excluir na tabela chama a Graph (hsm_id + name) e só então apaga o registro local. Motivo: a Meta tem DELETE oficial; apagar só no front deixava o template na biblioteca. Docs: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-management
- 2026-09-02: o prompt inclui moldes de formato da biblioteca Utility da Meta (prints). Só estrutura; o assunto é o texto base.
- 2026-09-02: a IA Utility se realimenta com templates do tenant já APPROVED+UTILITY (few-shot). Não há treino do GPT. Motivo: cada aprovação real vira referência na próxima geração.
- 2026-09-02: IA Utility inclui âncoras Confirmação, Status Confirmado, Confirmado, aprovado, concluído, atualizado, liberado. Motivo: a Meta tende a ler esses termos como mensagem de utilidade. Uma âncora por opção, sem oferta nova.
- 2026-09-02: IA Utility do laboratório Cloud usa léxico Olá / Informamos que / Para e botões informativos. Motivo: a Meta recategorizou os templates para Marketing. Docs: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization
- 2026-09-02: card de relatórios lista todos os portfólios; o select do formulário de criação não controla a tabela.
- 2026-09-02: exclusão só no `sessionStorage` foi substituída pela Graph + prune no sync.
- Docker EasyPanel copia `dist/`. Build precisa ir no Git antes do Redeploy.
- Traefik deste VPS usa entryPoints `http`/`https`, nunca `web`/`websecure`.
