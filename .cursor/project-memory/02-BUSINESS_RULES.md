# Regras de Negócio

Somente regras permanentes. Sem detalhes de implementação.

## Regras

### Reenvio de boas-vindas (assinante)

- O master pode reenviar e-mail e WhatsApp de boas-vindas pelo Admin · Assinantes.
- **Não** se pede nem se exige a senha do assinante no reenvio.
- A senha em plaintext **não** é armazenada; no reenvio a mensagem usa fallback orientando a senha do cadastro / “Esqueci a senha”.
- Canais do reenvio: e-mail + WhatsApp (Evolution), pelos canais já configurados para boas-vindas.

### Owners excluídos de métricas e split

Campanhas e pedidos dos e-mails abaixo **não** entram na contabilização de:

- Dashboard do menu Admin
- Split / Financeiro (settlements e product metrics)
- Indicadores do Dashboard do menu Disparos (visão consolidada master)

E-mails:

- `mozart.pmo@gmail.com`
- `quantumivst@gmail.com`
- `walkup@walkuptec.com.br`

Lista no código: `src/billing/waba-metrics-excluded-owners.ts`. Settlements já gravados desses owners são removidos no load do Financeiro/Admin.

### Ambientes

- Publicação permitida apenas em **Produção** (`master`).
- V02 e V03 existem só como localhost.
