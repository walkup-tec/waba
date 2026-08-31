# LOG — Portfólio único + lista de números oficiais

## Contexto do pedido

A Drax não precisa de um portfólio Meta por cliente. O cliente só precisa que a mensagem chegue. O modelo operacional é: **um portfólio Drax/Walkup**, vários números oficiais, templates aprovados, lista de leads e disparo. Logo do cliente entra no chip usado. A tela deve mostrar o card do portfólio (nome, ID, página principal) e a listagem de números com status **Ativo/Pendente** e **Livre/Em disparo**. Cada número novo precisa ser ativado (PIN de 6 dígitos).

## Ações executadas

- Documentação Meta: Embedded Signup adiciona o número; o Tech Provider registra com `POST /{PHONE_NUMBER_ID}/register` e PIN escolhido (não é SMS).
- Listagem via `GET /{WABA_ID}/phone_numbers` e dados do Business Manager (`id`, `name`, `primary_page`).
- UI alinhada ao Laboratório Drax (card escuro, verde WhatsApp, chips de status).

## Solução implementada

1. Card do portfólio abaixo do fluxo de conexão (nome, ID, página principal).
2. Lista de números daquele portfólio, com Ativo/Pendente e Livre/Em disparo.
3. **Adicionar número** reabre o Embedded Signup já com portfólio/WABA (não cria empresa nova).
4. **Ativar número** envia o PIN de 6 dígitos para a Meta.
5. `em_disparo` fica pronto no contrato; hoje todos os chips oficiais aparecem **Livre** até o disparo Cloud API gravar ocupação.

## Arquivos

- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.types.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.map.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-portfolio.test.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-connection.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-errors.ts`
- `src/integrations/meta-whatsapp/meta-es-fb-login.ts`
- `index.html`
- `package.json`

## Como validar

```bash
npm run test:meta-portfolio
npm run test:meta-es-login
npm run test:meta-phase3
```

Na tela Conectar WhatsApp (depois do Embedded Signup): card do portfólio visível, números listados, Pendente com campo PIN + Ativar.

## Segurança

- PIN não é logado.
- Resposta pública sem token.
- Tenant só vê a conexão da própria sessão.

## Palavras-chave

portfólio empresarial, phone_numbers, register PIN, Livre, Em disparo, Adicionar número, Embedded Signup prefill
