# Fix — operacional com WhatsApp persistido + notify de campanha por WhatsApp

## Contexto

Ao editar um usuário operacional em `Admin · Usuários`, o campo `WhatsApp` era salvo no front, mas ao reabrir o modal o valor não aparecia mais. Além disso, novas campanhas operacionais precisavam notificar também por WhatsApp, além do e-mail já existente.

## Problemas identificados

1. O front enviava `whatsapp` e `operacionalSegment`, mas o backend de usuários **ignorava** esses campos.
2. O repositório/serviço de `WabaSystemUser` não persistia nem expunha `whatsapp` e `operacionalSegment`.
3. A rotina `notifyOperacionalStaffOnCampaignCreated()` enviava apenas e-mail.

## Solução implementada

### Persistência de usuários do sistema

- `src/users/waba-system-user.repository.ts`
  - adicionado `whatsapp`
  - adicionado `operacionalSegment` (`bets` | `todos`)

- `src/users/waba-system-user.service.ts`
  - normalização e validação do WhatsApp com DDD
  - parse do segmento operacional
  - `create()` e `update()` agora persistem ambos os campos
  - `toPublicUser()` expõe `whatsapp`, `operacionalSegment` e `operacionalSegmentLabel`
  - migração leve de usuários operacionais legados: segmento default `todos`

- `src/admin/waba-admin.routes.ts`
  - `POST /admin/users` agora recebe `whatsapp` e `operacionalSegment`
  - `PATCH /admin/users/:id` agora recebe `whatsapp` e `operacionalSegment`

### Notify operacional por WhatsApp

- Novo arquivo: `src/mail/waba-operacional-campaign-whatsapp.service.ts`
  - envia mensagem via Evolution
  - tenta primeiro a instância do número `51981077770`
  - se indisponível, usa a instância do número `5197462102`
  - se ambas falharem, tenta resolução legada por instância conectada

- `src/mail/waba-mail.templates.ts`
  - novo builder de texto WhatsApp para campanha operacional
  - mesmo conteúdo-base do e-mail
  - sem link; texto final: **"Acesse seu painel operador"**

- `src/mail/waba-operacional-campaign-notify.service.ts`
  - mantém o e-mail
  - adiciona o envio por WhatsApp
  - agrega auditoria por destinatário:
    - status e mensagem do e-mail
    - status e mensagem do WhatsApp
    - instância usada no WhatsApp

- `src/disparos/waba-campaign-intake.repository.ts`
  - expandido o tipo de auditoria `operacionalNotifyAudit`

## Arquivos alterados

- `src/users/waba-system-user.repository.ts`
- `src/users/waba-system-user.service.ts`
- `src/admin/waba-admin.routes.ts`
- `src/mail/waba-mail.templates.ts`
- `src/mail/waba-operacional-campaign-notify.service.ts`
- `src/mail/waba-operacional-campaign-whatsapp.service.ts`
- `src/disparos/waba-campaign-intake.repository.ts`
- `dist/admin/waba-admin.routes.js`
- `dist/mail/waba-mail.templates.js`
- `dist/mail/waba-operacional-campaign-notify.service.js`
- `dist/mail/waba-operacional-campaign-whatsapp.service.js`
- `dist/users/waba-system-user.service.js`

## Comandos executados

- `git status --short`
- leituras de `routes`, `service`, `repository` e template de e-mail operacional
- `npm run build`

## Validação

1. Editar um operacional em `Admin · Usuários`
2. Informar `WhatsApp` e salvar
3. Reabrir o modal e confirmar que o número permanece carregado
4. Criar nova campanha de um plano atendido por esse operacional
5. Validar:
   - e-mail operacional recebido
   - WhatsApp operacional recebido
   - texto contém **"Acesse seu painel operador"**
6. Se precisar testar reenvio:
   - usar o fluxo já existente de reenvio operacional

## Observações

- O filtro por `segmento` ainda não altera roteamento de campanhas; nesta etapa ele foi persistido para suportar a próxima evolução.
- A regra atual de escolha do operacional continua pelo `operacionalDispatchesApi`.

## Segurança

- Nenhum segredo foi exposto.
- Sem alteração destrutiva em `/app/data`.
- Falhas de Evolution continuam tratadas com fallback e mensagens seguras.

## Pendências

- Confirmar em produção o recebimento do WhatsApp na conta do operacional após uma campanha nova real.
- Evoluir depois o uso do campo `segmento` na seleção do operacional.

## Palavras-chave

`waba-system-user`, `operacionalSegment`, `notifyOperacionalStaffOnCampaignCreated`, `waba-operacional-campaign-whatsapp.service`, `51981077770`, `5197462102`
