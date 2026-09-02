# LOG — IA Utility: léxico Olá / Informamos que / Para

## Contexto

Todos os templates do laboratório Cloud foram recategorizados pela Meta como Marketing. O usuário pediu um padrão mais próximo da biblioteca Utility e destes termos no corpo: **Olá**, **Informamos que**, **Para**. Botões: **Ver Detalhes**, **Saiba Mais**, **Ver Atualizações**. Prints da biblioteca serviram só de inspiração (não copiados).

## Ações

- Prompt 1.4 + política `meta-utility-lexicon-2026-09`.
- Pós-processo `shapeMetaUtilityAiOutput` garante o léxico mesmo se o modelo omitir.
- Select do laboratório Cloud deixou os CTAs de venda (Comprar agora, Solicitar agora, etc.).
- API Alternativa / Mensageiro não foi alterada.

## Solução

Utility na doc oficial exige conteúdo não promocional **e** ligado a ação/conta/solicitação do destinatário. Texto misto ou CTA persuasivo vira Marketing; desde 9/abr/2025 a Meta pode aprovar como Marketing mesmo se o pedido foi UTILITY.

- https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization
- Conceito: hot-reload não se aplica; a classificação é da Graph no create/review.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.prompt.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai-utility-shape.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai-shell.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.test.ts`
- `index.html`
- `src/deploy-marker.ts`

## Como validar

```bash
npm run test:meta-template-ai
```

Funcional: gerar 3 opções, conferir Olá / Informamos que / Para e o botão escolhido. A categoria final só aparece após a Meta.

## Palavras-chave

utility, marketing, Informamos que, Ver Detalhes, Saiba Mais, Ver Atualizações, template-categorization
