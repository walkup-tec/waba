# Financeiro fornecedores — prioridade, fila operacional e split pós-finalização (V02)

## Contexto

Implementação das regras pedidas para **Admin → Financeiro → Fornecedores** e **distribuição de campanhas operacionais** no ambiente V02 local.

## O que foi feito

### Cadastro de fornecedores (Financeiro)
- `SplitSupplier` estendido: `systemUserEmail`, `segment`, `priority` (1–5).
- Múltiplos fornecedores ativos por **plano + segmento**; prioridade única por grupo.
- UI: select de **operacional**; plano e segmento **readonly** (vindos do usuário); campos editáveis: custo/envio, PIX, prioridade.
- API overview expõe `operacionalUsers` para popular o select.

### Distribuição de campanhas
- Serviço `WabaCampaignSupplierAssignmentService`: atribuição inicial por plano + segmento + menor número de prioridade.
- Campos no intake: `assignedOperacionalEmail`, `assignedSupplierId`, `assignedAt`, `assignmentHistory`, `masterOverdueAlertSentAt`.
- Painel operacional filtra campanhas **só do assignee** (master vê todas).
- **BM inoperante**: `POST /admin/operacional/campanhas/:id/bm-inoperante` — reassign imediato; status assinante permanece **Gerada** até iniciar.
- **24h**: ícone relógio (`CAMPAIGN_START_OVERDUE_MS`) a partir de `assignedAt`.
- **30h**: tick a cada 10 min reatribui ao próximo da fila; se fila esgotada, alerta no sininho master via push system alert.
- Notificação e-mail/WhatsApp apenas ao operacional atribuído.

### Split de pagamento
- No pagamento do pedido: repasse PIX do fornecedor **adiado** quando há `systemUserEmail` (operacional).
- Após **Finalizar campanha** (`saveCampaignReport`): `payoutSupplierForCompletedCampaign` — PIX com base em `performanceReport.sent`.

## Arquivos principais

- `src/services/waba-campaign-supplier-assignment.service.ts` (novo)
- `src/billing/waba-financeiro-split.repository.ts`
- `src/billing/waba-financeiro-split.service.ts`
- `src/disparos/waba-campaign-intake.repository.ts`
- `src/admin/waba-operacional-campanhas.service.ts`
- `src/admin/waba-operacional-campanhas.routes.ts`
- `src/admin/waba-admin-financeiro.service.ts`
- `src/mail/waba-operacional-campaign-notify.service.ts`
- `src/push/waba-push-delivery.service.ts`
- `src/disparos/waba-campaign-intake.routes.ts`
- `src/index.ts`
- `index.html`

## Como validar (V02)

1. `npm run build` (OK em 2026-07-08).
2. Reiniciar `npm run dev:v02` se já estiver rodando.
3. **Financeiro → Fornecedores**: cadastrar 2+ operacionais mesmo plano/segmento com prioridades 1 e 2.
4. Gerar campanha como assinante → deve aparecer só no operacional prioridade 1.
5. Modal operacional → **BM inoperante** → campanha vai para prioridade 2.
6. Finalizar campanha com relatório → verificar settlement `campaign-supplier:{id}` (se payout habilitado).

## Observações

- Config legada de fornecedores sem operacional vinculado precisa ser re-salva no Financeiro.
- Regra Bets mantida: segmento operacional + assinante Bets.
- Sem commit/push (aguardando pedido explícito do usuário).

## Palavras-chave

`fornecedor prioridade`, `split operacional`, `BM inoperante`, `campaign-supplier-assignment`, `fila fornecedores`, `30h reassign`, `split pós finalizar`
