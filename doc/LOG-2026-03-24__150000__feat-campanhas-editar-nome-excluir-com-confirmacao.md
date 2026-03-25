# LOG: campanhas — editar nome e excluir com confirmação

## Pedido

No painel direito de campanhas: manter Ativar/Pausar; adicionar **Excluir** (com confirmação) e **Editar** (apenas nome).

## Backend (`src/index.ts`)

- `PATCH /disparos/campanhas/:id` — body `{ name }`; atualiza memória e Supabase (`campaign_name`).
- `DELETE /disparos/campanhas/:id` — remove campanha e leads da memória, limpa `campaignNextAllowedSendAt`; no Supabase remove `disparos_campaign_leads` e `disparos_campaigns`.

## Frontend (`index.html`)

- Botões **Editar nome** e **Excluir** em cada card.
- Modal renomear + modal excluir com texto explícito e **Sim, excluir** / Cancelar.
- Delegação de clique na lista; `escapeHtmlAttr` no `data-campaign-name`.

## Validar

- Editar nome → lista atualiza.
- Excluir → confirmação → some da lista; ativar/pausar continua igual.

## Palavras-chave

`dis-campaign-rename-overlay`, `dis-campaign-delete-overlay`, `PATCH disparos/campanhas`
