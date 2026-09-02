# Número Cloud ocupado até o relatório

## Contexto do pedido

No Disparo Cloud só podem aparecer números **Ativos e disponíveis**. Ao usar um número em um disparo ele assume **ocupado**. Só volta a **disponível** depois que a campanha for finalizada e o relatório for gerado.

## Ações executadas

- Ligar a ocupação aos broadcasts + status da campanha do assinante (intake).
- Filtrar o select do wizard e recusar start se o número já estiver em disparo.
- Documentar a regra permanente.

## Solução implementada

1. `listAllBroadcastCampaigns` lista todos os disparos do tenant (sem o teto de 8 da listagem da UI).
2. `isCloudPhoneBusyForCampaign` / `listBusyCloudPhoneNumberIds`:
   - com intake: ocupado em `generated` e `in_progress`; livre em `completed`, `error_reported` e `cancelled`;
   - sem intake: ocupado só em `queued` / `running`.
3. `listPortfolioAssets` carimba `dispatchStatus` (`livre` | `em_disparo`) em todos os números.
4. `requireActivePhone` recusa ocupado com mensagem explícita.
5. Select do wizard: `uiStatus === ativo` e `dispatchStatus !== em_disparo`.
6. Preview local: um número demo ocupado some do select; o Ativo e disponível permanece.

## Arquivos criados/alterados

- `src/integrations/meta-whatsapp/meta-whatsapp-phone-occupancy.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast.store.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-lab-report.test.ts`
- `index.html`
- `docs/project-memory/02-BUSINESS_RULES.md`
- `docs/project-memory/05-DECISIONS.md`
- `docs/project-memory/06-CURRENT_STATUS.md`
- `doc/memoria.md`

## Como validar

```bash
npm run test:meta-lab-report
```

No Laboratório: iniciar um Disparo Cloud com um número Ativo; o mesmo número some do select até o relatório da campanha fechar.

## Observações de segurança

Sem novos segredos. A ocupação deriva de arquivos de dados do tenant já existentes.

## Palavras-chave

numero-ocupado, dispatchStatus, em_disparo, disponivel, disparo-cloud, relatorio-meta
