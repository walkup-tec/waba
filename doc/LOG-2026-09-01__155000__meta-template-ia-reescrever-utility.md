# Assistente IA: reescrever texto base em 3 Utility

## Contexto

O assistente recusava textos promocionais (`eligibleForUtility=false`,
`options=[]`), exibindo "Não foi possível gerar opções Utility". A missão
pedida é outra: pegar o texto base, manter o tema central e formatar três
templates Utility, como no exemplo de margem consignável.

## Solução

- Prompt 1.1: não recusar; reescrever ancorando em evento anterior
  (solicitação/consulta/simulação) nas abordagens atualização, resultado e
  acompanhamento.
- JSON Schema exige exatamente 3 opções, `recommendedCategory=UTILITY`,
  `assumedPriorEvent`, `title` e `buttonText` (QUICK_REPLY).
- Texto promocional original pode manter risco MEDIUM/HIGH; isso não bloqueia
  a geração. A decisão final continua da Meta.
- Cadastro envia BODY + botão operacional.
- UI mostra título, corpo e botão; **Enviar para Meta** aparece quando há 3
  opções.

Critério oficial usado no prompt: Utility precisa ser não promocional **e**
específica a / solicitada pelo usuário.
Fonte: https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.prompt.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.schema.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.types.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.test.ts`
- `index.html`
- `src/deploy-marker.ts`

## Validação

```bash
npm run test:meta-template-ai
npm run build
```

Preview: `/?ui-preview=template-ai`

Validação funcional em produção: colar o texto de margem consignável, clicar
**Gerar** e conferir as 3 opções no painel direito antes de enviar à Meta.

## Segurança

- Chave OpenAI só no backend.
- Sem envio automático à Meta.
- Sem garantia de aprovação.
