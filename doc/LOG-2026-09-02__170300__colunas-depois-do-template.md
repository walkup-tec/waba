# Colunas da planilha só depois do template

## Contexto do pedido

Coluna do telefone e coluna do nome só devem aparecer após a escolha do template. As variáveis do modelo definem o mapeamento. Se houver variável, é só uma: nome ou número.

## Ações executadas

- Esconder os campos de coluna até existir template selecionado.
- Resolver o mapeamento no backend para no máximo uma variável de BODY.

## Solução implementada

1. `meta-tpl-broadcast-phone-wrap` começa oculto; só abre com template.
2. Nome aparece só com variável `nome`. Número só com variável `numero` e sem nome.
3. `resolveBroadcastColumnMapping` garante nome XOR número.
4. Sem template, a prévia pede para escolher o modelo antes de mapear.

## Arquivos criados/alterados

- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast-template.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-broadcast.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-cloud-recipient.test.ts`
- `index.html`
- `docs/project-memory/02-BUSINESS_RULES.md`
- `docs/project-memory/06-CURRENT_STATUS.md`
- `doc/memoria.md`

## Como validar

Abrir o Disparo Cloud sem template: sem colunas. Escolher um modelo com `{{1}}` de nome: telefone + nome. Trocar para template sem variável: só telefone.

```bash
npm run test:meta-broadcast
```

## Observações de segurança

Sem novos segredos.

## Palavras-chave

coluna-telefone, coluna-nome, variavel-template, disparo-cloud
