# Banco

Tabela `meta_whatsapp_templates`: `tenant_id`, `connection_id`, `waba_id`, nome, idioma, categoria, status Meta, componentes, qualidade, última sync.

Listagem geral: `eq("tenant_id")`. Listagem de um portfólio: também `connection_id`.

Operacional/suporte com menu do Laboratório usa o `tenant_id` do dono do lab, não o do próprio e-mail.

Disparo Cloud: arquivo JSON `meta-whatsapp-broadcasts.json` no data dir (campanhas, leads, cliques). Encurtador: `shortener-links.json` com `campaignId` opcional.
