# Arquitetura

Painel monolítico (`index.html` + `src/`) com rotas Express.

Templates Meta:

- rotas em `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- regras em `meta-whatsapp-template.service.ts`
- persistência em `meta-whatsapp-template.repository.ts` (Supabase, `tenant_id`)
- UI do laboratório no card **Templates WhatsApp**
- A IA de Utility não é um modelo treinado: a cada geração o GPT recebe o prompt + até 8 templates do tenant com status APPROVED e categoria UTILITY.
