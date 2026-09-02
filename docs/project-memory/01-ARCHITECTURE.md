# Arquitetura

Painel monolítico (`index.html` + `src/`) com rotas Express.

Templates Meta:

- rotas em `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- regras em `meta-whatsapp-template.service.ts`
- persistência em `meta-whatsapp-template.repository.ts` (Supabase, `tenant_id`)
- UI do laboratório no card **Templates WhatsApp**
