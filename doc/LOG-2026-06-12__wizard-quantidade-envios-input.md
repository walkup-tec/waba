# LOG — Wizard quantidade de envios (etapa 5)

**Data:** 2026-06-12  
**Contexto:** Assinante informa manualmente quantos envios deseja na campanha, após importar planilha.

## Solicitação
- No modal Nova campanha, etapa 5, após contagem da importação, input para quantidade de leads/envios.
- Não ultrapassar envios disponíveis no momento.
- Planilha deve ter linhas suficientes para a quantidade solicitada.

## Arquivos alterados
- `index.html` — HTML/CSS/JS do wizard (input, validação, FormData `plannedSendCount`)
- `src/disparos/waba-campaign-intake.routes.ts` — parse e validação server-side
- `dist/*` — via `npm run build`

## Comportamento
- Após importar `.xlsx`/`.xls`: mostra contagem de linhas + campo "Quantidade de envios desta campanha".
- Sugestão inicial: `min(linhas, saldo disponível)`; usuário pode alterar.
- Hint: contatos na planilha + envios disponíveis no saldo.
- Submit bloqueado se quantidade inválida, > saldo ou > linhas importadas.

## Validação
- `npm run build` — OK

## Pendências
- Testar no browser com usuário mozart (`dev:v02`).
- Commit/deploy somente se usuário pedir.
