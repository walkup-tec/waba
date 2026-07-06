# LOG — E-mail operacional ao gerar campanha

**Data:** 2026-06-26  
**Marker:** `DEPLOY-2026-06-26-operacional-email-nova-campanha`

## Pedido

Quando uma campanha é criada (intake), o **usuário operacional** designado para o plano correspondente (API Oficial ou API Alternativa) deve receber e-mail informando que há campanha aguardando configuração.

Conteúdo: tom amigável, data de criação, ID do assinante, nome da campanha, envios registrados, prazo de **24 horas** para configurar.

Remetente: mesmo SMTP atual (`MAIL_FROM` / `SMTP_*`). Destino: e-mail cadastrado do operacional.

Escopo: **somente** operacionais com `operacionalDispatchesApi` igual ao `apiKind` da campanha.

## Implementação

1. **`notifyOperacionalStaffOnCampaignCreated`** — hook após `POST /disparos/campanhas/intake` criar intake com status `generated`.
2. **`WabaSystemUserService.listOperacionalUsersForDispatchesApi`** — filtra role `operacional` + plano.
3. **`buildOperacionalNewCampaignTemplate`** — HTML cordial PT-BR (mesmo shell dos demais e-mails).
4. **`waba-mail-delivery`** — `deliverOperacionalNewCampaignEmail` / `notifyOperacionalNewCampaignEmail` (assíncrono).
5. **Deep link** — `?operacionalCampanha=<id>` abre Admin · Campanhas e modal de detalhes.

## Arquivos

- `src/mail/waba-operacional-campaign-notify.service.ts` (novo)
- `src/mail/waba-mail.templates.ts`
- `src/mail/waba-mail-delivery.ts`
- `src/mail/waba-app-url.ts`
- `src/users/waba-system-user.service.ts`
- `src/disparos/waba-campaign-intake.routes.ts`
- `index.html` (deep link)
- `src/deploy-marker.ts`

## Validar

1. Operacional A = API Oficial, Operacional B = API Alternativa (Admin · Usuários).
2. Assinante gera campanha API Oficial → e-mail só para operacional Oficial.
3. Corpo com data, ID assinante, nome, envios, prazo 24h.
4. Botão abre painel na campanha correta.
5. `GET /health` → marker após redeploy Node.

## Segurança

- E-mail não vai ao assinante nem a operacionais de outro plano.
- Falha de SMTP não bloqueia criação da campanha (fire-and-forget + log).

## Palavras-chave

`operacional`, `email`, `nova campanha`, `intake`, `apiKind`, `24 horas`, `SMTP`
