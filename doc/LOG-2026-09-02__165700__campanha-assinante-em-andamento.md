# Campanha do assinante: só Em andamento

## Contexto do pedido

No Disparo Cloud, a campanha do assinante deve listar só as **Em andamento**, no formato `nome do assinante - nome da campanha - envios`.

## Ações executadas

- Filtrar o GET `linkable-campaigns` e o vínculo no start para `in_progress`.
- Resolver o nome do assinante no cadastro e montar o rótulo no backend e na UI.

## Solução implementada

1. `isLinkableLabCampaignStatus` aceita só `in_progress` (Em andamento).
2. `generated` / finalizadas não entram no select e o start recusa.
3. Rótulo: `Maria Silva - Campanha Setembro - 500`. Sem nome, usa o e-mail.
4. Preview local usa o mesmo formato.

## Arquivos criados/alterados

- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast-linkable.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-lab-report.test.ts`
- `index.html`
- `docs/project-memory/02-BUSINESS_RULES.md`
- `docs/project-memory/06-CURRENT_STATUS.md`
- `doc/memoria.md`

## Como validar

```bash
npm run test:meta-lab-report
```

No wizard: só campanhas Em andamento; Gerada / Finalizado não aparecem.

## Observações de segurança

Sem novos segredos. O nome vem do cadastro do assinante.

## Palavras-chave

campanha-assinante, em-andamento, linkable-campaigns, disparo-cloud
