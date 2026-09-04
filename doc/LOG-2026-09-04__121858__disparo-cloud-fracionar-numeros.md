# LOG — Disparo Cloud: fracionar envios em múltiplos números

## Contexto
No Disparo Cloud, o envio saía de um único número Ativo. Para reduzir risco de spam, os envios precisam ser fracionados entre vários números do mesmo portfólio, com teto de **500 envios por número**, mantendo **um único relatório** ao final.

## Solução
1. Backend aceita `phoneNumberIds[]` (mesmo portfólio, todos Ativos/disponíveis).
2. Distribuição equilibrada (`distributeBroadcastLeadsAcrossPhones`) com máx. 500/número; rejeita se faltar capacidade.
3. Cada lead recebe `phoneNumberId`; o envio e a mídia de cabeçalho usam o número atribuído.
4. Ocupação marca **todos** os números da campanha como em disparo.
5. Match de webhook/status considera a lista `phoneNumberIds`.
6. UI reordenada: portfólio → template → campanha → multi-seleção de números + preview da distribuição → planilha → iniciar.
7. Relatório permanece unificado (mesma campanha / intake).

## Arquivos
- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast-split.ts` (+ teste)
- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-phone-occupancy.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- `index.html` / `dist/index.html`
- `src/deploy-marker.ts`

## Validação
- `node --require ts-node/register --test src/integrations/meta-whatsapp/meta-whatsapp-broadcast-split.test.ts`
- `node --require ts-node/register --test src/integrations/meta-whatsapp/meta-whatsapp-lab-report.test.ts`
- `npx tsc --noEmit -p tsconfig.json`
- Validação funcional completa depende de portfólio real com vários números Ativos e campanha Em andamento no Laboratório.

## Palavras-chave
disparo cloud, fracionar, multi-número, 500 por número, anti-spam, relatório unificado, phoneNumberIds
