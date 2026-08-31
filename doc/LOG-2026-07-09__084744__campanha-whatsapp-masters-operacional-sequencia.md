# Campanha nova — WhatsApp masters + operacional atribuído + sequência unificada

## Contexto

Pedido do usuário (item 3 da confirmação de comunicação):

- **Nunca** broadcast para todos os operacionais compatíveis — sempre há **1 operacional atribuído**; em troca, o **novo** operacional recebe a mensagem.
- Texto WhatsApp: `Nova campanha gerada na plataforma da Drax. [xx mil envios] - [dd/mm/aaaa] - [Nome do operacional]`
- Enviar para **masters** (WhatsApp) + **operacional atribuído** (e-mail + WhatsApp).
- **Todas** as mensagens WhatsApp do sistema: sequência `51981077770` → `51997462102` → `51981082477`.

## Solução implementada

1. **`waba-evolution-whatsapp-delivery.service.ts`** — módulo compartilhado com sequência de 3 instâncias, retry síncrono (até 15 rodadas) e retry em background.
2. **`waba-operacional-campaign-notify.service.ts`** — removido broadcast; notifica só operacional atribuído + todos os masters com WhatsApp válido; sem atribuição → log + lista vazia.
3. **`waba-mail.templates.ts`** — `buildOperacionalNewCampaignWhatsAppText` no formato curto (envios em mil quando ≥1000, data dd/mm/aaaa).
4. **`waba-welcome-whatsapp.service.ts`** — boas-vindas usa `deliverWabaEvolutionWhatsApp`.
5. **`uptime-monitor.service.ts`** e **`asaas-integration-monitor.service.ts`** — alertas via módulo compartilhado.
6. **`waba-system-user.service.ts`** — `listMasterUsers()` para destinatários master.
7. **`deploy-marker.ts`** — `DEPLOY-2026-07-09-campanha-whatsapp-masters-operacional`.

## Arquivos alterados

- `src/mail/waba-evolution-whatsapp-delivery.service.ts` (novo)
- `src/mail/waba-operacional-campaign-whatsapp.service.ts`
- `src/mail/waba-operacional-campaign-notify.service.ts`
- `src/mail/waba-mail.templates.ts`
- `src/mail/waba-welcome-whatsapp.service.ts`
- `src/users/waba-system-user.service.ts`
- `src/monitoring/uptime-monitor.service.ts`
- `src/monitoring/asaas-integration-monitor.service.ts`
- `src/admin/waba-operacional-campanhas.service.ts` (mensagem reenvio)
- `src/deploy-marker.ts`

## Como validar

1. `npm run build` — OK.
2. Criar campanha com operacional atribuído → WhatsApp operacional + masters com texto curto.
3. Reatribuir campanha (BM inoperante) → novo operacional recebe WhatsApp.
4. `GET /health` após redeploy → marker `DEPLOY-2026-07-09-campanha-whatsapp-masters-operacional`.

## Observações

- E-mail de nova campanha continua **somente para o operacional** (masters só WhatsApp).
- Masters precisam ter `whatsapp` cadastrado em Admin · Usuários.

## Palavras-chave

`notifyOperacionalStaffOnCampaignAssigned`, `deliverWabaEvolutionWhatsApp`, `listMasterUsers`, `buildOperacionalNewCampaignWhatsAppText`, `51981077770`, remover broadcast operacionais
