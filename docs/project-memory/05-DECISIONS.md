# Decisões

- 2026-09-02: o prompt inclui moldes de formato da biblioteca Utility da Meta (prints). Só estrutura; o assunto é o texto base.
- 2026-09-02: a IA Utility se realimenta com templates do tenant já APPROVED+UTILITY (few-shot). Não há treino do GPT. Motivo: cada aprovação real vira referência na próxima geração.
- 2026-09-02: IA Utility do laboratório Cloud usa léxico Olá / Informamos que / Para e botões informativos. Motivo: a Meta recategorizou os templates para Marketing. Docs: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization
- 2026-09-02: card de relatórios lista todos os portfólios; o select do formulário de criação não controla a tabela.
- 2026-09-02: exclusão da tabela é só front (`sessionStorage`). Motivo: o usuário pediu remover da UI sem integração Meta.
- Docker EasyPanel copia `dist/`. Build precisa ir no Git antes do Redeploy.
- Traefik deste VPS usa entryPoints `http`/`https`, nunca `web`/`websecure`.
