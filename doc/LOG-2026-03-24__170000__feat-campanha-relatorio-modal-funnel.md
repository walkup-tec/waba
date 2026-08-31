# LOG: Relatório de campanha (modal + funil) e falhas de lead

## Pedido

Botão **Relatório** por campanha, modal com totais (envios, sucesso, números errados) e gráfico em barras horizontais estilo funil.

## Backend

- `DisparosCampaignLead.failureKind` opcional: `invalid_phone` | `destination_error` | `send_error`.
- Validação `isPlausibleBrWhatsappDestinationDigits` antes do envio; falha EVO classificada com `classifyEvoSendFailure` (heurística para destino indisponível vs técnico).
- `persistLeadFailed` + `scheduleNextCampaignDispatchDelay`; envios com falha não ficam pendentes para sempre.
- **GET `/disparos/campanhas/:id/relatorio`**: agrega leads (memória ou Supabase), `textoNumerosErrados`, `funnel[]` com % do topo, `detalheErros`.
- `fetchLeadsFromDbForCampaignReport`, `fetchCampaignHeaderFromDb` quando memória vazia.

## Frontend

- Botão **Relatório** na linha da campanha; modal `#dis-campaign-report-overlay`; estilos funil (`.dis-funnel-*`).
- Listener + exclusão no guard global de instâncias (`.btn-campaign-report`).

## Arquivos

- `src/index.ts`, `index.html`

## Palavras-chave

- relatorio campanha, `/disparos/campanhas/:id/relatorio`, persistLeadFailed, btn-campaign-report
