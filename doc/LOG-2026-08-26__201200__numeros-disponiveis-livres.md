# LOG — Números disponíveis só se não estiverem em campanha aberta

## Contexto do pedido

A lista «Números disponíveis» mostrava chips já usados em campanha (ex.: Corbans: WB-7770, 5401, 2477, 9224). Só devem aparecer números livres até a campanha anterior ser finalizada.

## Causa

O picker filtrava só «não está na seleção atual da tela» + `open` + Disparador. Não consultava campanhas `running`/`paused`.

## Solução

1. Backend: `namesHeldByUnfinishedCampaigns`; `GET /disparos/campanhas` devolve `selectedInstanceNames` e `instancesHeldByUnfinishedCampaigns`.
2. Criar campanha / `+ Instâncias` recusa número já ocupado (409).
3. Auto-swap não pega chip de outra campanha aberta.
4. UI: disponíveis excluem ocupados (nome técnico e alias WB-*).

## Arquivos

- `src/proxy/proxy-brasil-campaign.rules.ts`
- `src/index.ts`
- `src/deploy-marker.ts`
- `index.html` / `dist/index.html`
- `dist/` JS correspondente
- `doc/memoria.md`

## Como validar

1. Selfcheck: `node dist/proxy/proxy-brasil-campaign.rules.selfcheck.js`
2. Após Redeploy: marker `DEPLOY-2026-08-26-numeros-disponiveis-livres`
3. Com Corbans running/paused, a lista disponíveis não mostra 2477/5401/7770/9224
4. Após finalizar Corbans, voltam a aparecer

## Palavras-chave

números disponíveis, campanha ocupada, selectedInstanceNames, heldByUnfinished
