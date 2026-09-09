# Banco

Tabela `meta_whatsapp_templates`: `tenant_id`, `connection_id`, `waba_id`, nome, idioma, categoria, status Meta, componentes, qualidade, última sync.

Listagem geral: `eq("tenant_id")`. Listagem de um portfólio: também `connection_id`.

Operacional/suporte com menu do Laboratório usa o `tenant_id` do dono do lab, não o do próprio e-mail.

Disparo Cloud: arquivo JSON `meta-whatsapp-broadcasts.json` no data dir. Campanha: `intakeCampaignId`, `status`, `sendStartedAt`, `sendFinishedAt`, `lastMetaStatusAt`, `reportFinalizedAt`, `clicks`. Lead: `waId`, `wamid`, `status` (fila/envio), `metaStatus` (aceite/entregue/lido/falhou da Meta), `errorCode`, `statusLog`. Encurtador: `shortener-links.json` com `campaignId` opcional. Intake do assinante: `performanceReport.source = meta_lab` quando o Laboratório fecha o relatório.
