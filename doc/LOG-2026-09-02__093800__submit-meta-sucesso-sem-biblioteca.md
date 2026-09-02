# LOG — Envio à Meta: sucesso falso e WABA certo

## Contexto

Envio para o portfólio Quantum Smart Labs deu sucesso no WABA, mas o WhatsApp Manager (conta de teste, só modelos ativos) não listava os templates.

## Causas

1. A tela da Meta no print é **Test WhatsApp Business Account**, filtro **modelos ativos** e últimos 7 dias. O POST Graph cria em **PENDING / em análise**, não em Ativo.
2. Se a análise já tinha os nomes (envio anterior) e o local foi apagado, o lote marcava `ok` sem chamar a Graph. O modal ainda mostrava «Template 01/02/03 Enviado».

## Solução

- Só pula a Graph se o template **ainda existe** no portfólio local.
- Se foi apagado, reenvia.
- Modal mostra nome real, status Graph, portfólio e WABA, e avisa para olhar **em análise** no mesmo WABA.

## Como validar

```bash
npm run test:meta-template-ai
```

Enviar de novo: o modal deve listar `nome_1` etc. e o WABA. Na Meta, abrir essa conta e tirar o filtro só de Ativo.

## Palavras-chave

submit-all, ALREADY_SUBMITTED, Quantum Smart Labs, em análise, WABA
