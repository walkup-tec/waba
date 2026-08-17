# LOG — Override de Lidos no relatório (código)

## Contexto

Alterar **somente** o indicador **Lidos** no relatório, sem patch SSH no JSON:

- SQUARE RESIDENCIAL (14/08/2026) → **480**
- 6 DE AGOSTO (14/08/2026) → **518**

## Solução

Helper `src/disparos/waba-campaign-report-read-overrides.ts` aplicado na leitura do relatório:

- GET `/disparos/campanhas/intake/:id/relatorio`
- Dashboard consolidado
- Relatório operacional (`getCampaignReport`)

Não altera Enviados, Entregues, Falhados nem créditos. Marker `DEPLOY-2026-08-17-lidos-relatorio-480-518`.

## Como validar

Após Redeploy Easypanel `waba_disparador`:

1. `/health` com o marker acima
2. Abrir relatório das duas campanhas e conferir Lidos 480 e 518
3. Taxa de leitura = Lidos ÷ Entregues

## Palavras-chave

`lidos`, `relatorio`, `SQUARE RESIDENCIAL`, `6 DE AGOSTO`, `performanceReport`
