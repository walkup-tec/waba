# LOG: campanhas — botão Ativar / Pausar no painel direito

## Contexto

Após criar a campanha, ela deve aparecer no painel direito. Cada campanha precisa de um botão que alterne a legenda:

- **Ativar campanha** → ao ativar, o motor de disparo processa a campanha; a legenda passa a **Pausar**.
- **Pausar** → interrompe envios até nova ativação; a legenda volta a **Ativar campanha**.

## Ações executadas

- Ajuste no backend (`src/index.ts`): correção TS5076 em `mapRowToItem` (mistura `??` e `||` sem parênteses).
- Confirmação da regra em `POST /disparos/campanhas/:id/estado`: campanha obrigatória após `hydrateCampaignFromDbIfNeeded` (404 se não existir).
- Frontend (`index.html`): cards da lista `#disparos-list` com layout flex, botão `.btn-campaign-toggle`, `data-campaign-id` e `data-campaign-running`, delegação de clique, função `setDisparosCampaignActive`, polling `startDisparosCampaignsPolling` / `stopDisparosCampaignsPolling` na aba Disparos (10s).

## Arquivos alterados

- `src/index.ts`
- `index.html`
- `doc/memoria.md`
- `doc/LOG-2026-03-24__140635__feat-campanhas-ativar-pausar-ui.md` (este arquivo)

## Como validar

1. `npm run build` e `npm start` (ou fluxo equivalente).
2. Aba **Disparos**: criar campanha; verificar card à direita com **Ativar campanha**.
3. Clicar em **Ativar campanha** → legenda **Pausar** e envios conforme motor/tick.
4. Clicar em **Pausar** → legenda **Ativar campanha** e envios interrompidos até reativar.

## Segurança

- Nenhum segredo adicionado; apenas chamadas aos endpoints já expostos da aplicação.

## Palavras-chave

`campanha-ativar-pausar`, `disparos-campanhas-estado`, `btn-campaign-toggle`, `running`, `paused`
