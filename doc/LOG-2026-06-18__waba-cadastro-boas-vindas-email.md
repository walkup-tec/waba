# LOG — e-mail boas-vindas cadastro landing

**Data:** 2026-06-18

## Pedido
E-mail de boas-vindas ao cadastrar na landing de vendas: dados do cadastro + botão login + tom comercial.

## Implementação
- Template `buildSubscriberWelcomeTemplate` (nome, e-mail, WhatsApp, telefone, CPF/CNPJ).
- Disparo assíncrono em `POST /subscribers/register`.
- Botão **Acessar o sistema** → `WABA_APP_LOGIN_URL`.
- Marker: `DEPLOY-2026-06-18-waba-cadastro-boas-vindas-email`

## Validar
Cadastro na landing → e-mail na caixa do assinante (SMTP configurado).
