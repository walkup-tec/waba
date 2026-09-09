# Arquitetura

Painel monolítico (`index.html` + `src/`) com rotas Express.

Templates Meta:

- rotas em `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- regras em `meta-whatsapp-template.service.ts`
- persistência em `meta-whatsapp-template.repository.ts` (Supabase, `tenant_id`)
- UI do laboratório: Templates WhatsApp (lista/criar) e menu **Disparo Cloud** (wizard + histórico)
- A IA de Utility não é um modelo treinado: a cada geração o GPT recebe o prompt + até 8 templates do tenant com status APPROVED e categoria UTILITY.

## Disparo Cloud e relatório Meta

O envio Cloud (`runCampaign`) vive na memória do Node. Graph 200 grava o lead como `accepted` em `meta-whatsapp-broadcasts.json`. Entregue, lido e falhou entram só pelo webhook `statuses` (casa por `wamid` ou `recipient_id`). Cada save do disparo faz merge e preserva o maior `metaStatus` já gravado.

O fechamento do relatório (`meta-whatsapp-broadcast-report.ts`) roda no boot (sweep 60 s) e após cada status da Meta. O JSON permanece em coleta enquanto os leads aceitos estiverem só em `accepted`/`sent`. Fecha após 15 min de silêncio quando já existe delivered/read/failed. Teto de 3 h só se a Meta já tiver enviado status terminal. Webhook tardio atualiza relatório `meta_lab` já finalizado (`refreshCompletedLabIntakeReport`), sem mexer em bônus.

Clique no botão URL (`/s/:slug`) incrementa `clicks` da mesma campanha. O número Cloud fica ocupado até o relatório fechar.
