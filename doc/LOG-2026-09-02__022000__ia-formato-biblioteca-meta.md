# LOG — IA Utility: formato da biblioteca Meta

## Contexto

O usuário pediu que o GPT também use o padrão dos prints da biblioteca Utility da Meta como referência de formato, sem sair do tema do texto base.

## Ações

- Prompt 1.6: seção **BIBLIOTECA UTILITY DA META — só FORMATO**.
- Moldes: fato + "Para mais informações… use o link abaixo"; status + "Para consultar…"; Olá + Informamos que; tom de confirmação/atualização/lembrete.
- Proibido copiar temas ou nomes da biblioteca (aeroporto, crise, cartão, `crisis_response_2`, etc.).

Doc oficial de categoria: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization

## Como validar

```bash
npm run test:meta-template-ai
```

Gerar no laboratório e conferir que o assunto continua o do texto base.

## Palavras-chave

biblioteca meta, formato, texto base, utility, prompt 1.6
