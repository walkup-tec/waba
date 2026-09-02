# Histórico no lugar da prévia de números

## Contexto do pedido

Remover a pré-visualização e a tabela por número. Depois de iniciar o disparo, mostrar as campanhas iniciadas com data, nome da campanha, nome do cliente, quantidade de envios, barra de andamento e status.

## Ações executadas

- Tirar o botão e a caixa de prévia.
- Enriquecer o GET das campanhas Cloud com dados do assinante e do andamento.
- Renderizar a tabela de histórico e atualizar enquanto houver envio em curso.

## Solução implementada

1. `toCloudBroadcastHistoryItem` monta data, cliente, envios, percentual e rótulo de status.
2. A tabela fica abaixo de Iniciar disparo.
3. A planilha ainda preenche as colunas em silêncio, sem exibir cada número.
4. Preview local já nasce com uma linha Em andamento.

## Arquivos criados/alterados

- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast-history.ts`
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

Iniciar um disparo e conferir a tabela (não deve existir prévia de números).

## Observações de segurança

Sem novos segredos.

## Palavras-chave

historico-disparo, barra-andamento, sem-previa, campanha-iniciada
