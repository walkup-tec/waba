# LOG — Deduplicar leads do wizard Oficial

## Contexto do pedido

Quando o assinante sobe a planilha de leads da campanha de API Oficial, a mesma pessoa podia entrar mais de uma vez (formato diferente, com/sem 9º dígito). Isso inflava créditos e `plannedSendCount`. O Disparo Cloud já ignorava duplicata na hora do POST; o intake do assinante não.

## Ações executadas

- Extraída a regra de chave do Cloud (`normalizeMetaSpreadsheetRecipient` + `metaSpreadsheetRecipientDedupeKey`) para o POST `/disparos/campanhas/intake` quando `apiKind=oficial`.
- O arquivo original continua gravado; o arquivo de envio (`leads-N-envios`) sai único e depois cortado ao limite contratado.
- Wizard conta contatos únicos no preview e avisa quantos duplicados saíram.
- Versão do intake: 6 (`WABA_CAMPAIGN_INTAKE_API_VERSION`).
- Testes: `npm run test:campaign-intake-dedupe`.

## Solução

1. `parseOfficialCampaignLeadsUnique` lê a planilha/TXT e mantém 1 linha por WhatsApp.
2. Linha sem telefone válido não entra na contagem.
3. `writeOfficialCampaignLeadsFile` gera o buffer único (e fatia se houver limite de envios), sem tratar cabeçalho TXT como lead.
4. Alternativa segue `countLeadsImportedRows` (todas as linhas).
5. Resposta 201/200 inclui `duplicatesRemoved` e `importSummary` com o texto de exclusão.

## Arquivos

- `src/disparos/waba-campaign-intake-oficial-dedupe.ts`
- `src/disparos/waba-campaign-intake-oficial-dedupe.test.ts`
- `src/disparos/waba-campaign-intake.routes.ts`
- `src/disparos/waba-campaign-intake.constants.ts`
- `index.html`
- `package.json`

## Como validar

```bash
npm run test:campaign-intake-dedupe
```

No wizard Oficial: subir Excel/TXT com o mesmo número em formatos diferentes. A quantidade de envios e o débito de créditos devem ser 1 por WhatsApp. Mínimo de 1000 vale sobre únicos.

## Segurança

Sem segredos. Só normalização de telefone já usada no Cloud.

## Palavras-chave

oficial, dedupe, planilha, leads, wizard, 9 digito, intake, duplicidade
