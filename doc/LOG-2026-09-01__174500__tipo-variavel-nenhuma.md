# Tipo de variável: opção Nenhuma

## Contexto

O select **Tipo de variável** só tinha Nome e Número. Pedido: opção **Nenhuma**, e nessa escolha não enviar variáveis no corpo à Meta.

## Solução

- UI: opção `nenhuma`.
- Geração IA: `variableType=nenhuma` pede corpo estático, sem `{{1}}`.
- Cadastro: mesmo se a IA devolver placeholder, o BODY é limpo e vai sem `example.body_text`.

## Arquivos

- `index.html`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai-shell.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.prompt.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.test.ts`
- Marker: `DEPLOY-2026-09-01-174500-variavel-nenhuma`

## Como validar

```bash
npm run test:meta-template-ai
```

Preview: `/?ui-preview=template-ai` — o select tem Nenhuma.

## Palavras-chave

tipo de variável, nenhuma, placeholder, {{1}}, body estático
