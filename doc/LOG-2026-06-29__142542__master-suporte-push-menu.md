# LOG — Master · Suporte · Push

## Contexto

Pedido para adicionar menu **Push** na seção **Suporte** (tela master), com:
- Escrita de mensagem + revisão por IA (GPT)
- Destinos: Assinantes, Usuários (filtro operacional/suporte), Comunidade WhatsApp, E-mail
- Alertas in-app para assinantes/usuários
- Comunidade via instância `walkup` (admin da comunidade)

## Solução implementada

### Backend (`src/push/`, `src/admin/`)

- `waba-push.types.ts` — tipos de audience, status, alert view
- `waba-push.repository.ts` — persistência JSON (`waba-push-messages.json`, `waba-push-config.json`)
- `waba-push-openai.service.ts` — revisão ortográfica/clareza via OpenAI
- `waba-push-community.service.ts` — envio EVO para grupo de Anúncios da comunidade
- `waba-push-delivery.service.ts` — orquestra envio (in-app, comunidade, e-mail)
- `waba-admin-push.service.ts` — camada admin
- Rotas:
  - `POST /admin/push/review` — revisão IA (master)
  - `POST /admin/push/send` — publicar push (master)
  - `GET /admin/push/history` — histórico
  - `GET/PUT /admin/push/community-config` — config comunidade
  - `GET /push/alerts` — alertas ativos para sessão
  - `POST /push/alerts/:id/dismiss` — dispensar alerta

### Frontend (`index.html`)

- Menu **Push** em Suporte (desktop + mobile)
- Aba `#tab-admin-push`: título, mensagem original, revisão IA, destinos, tipos de usuário, histórico
- Banner `#waba-push-alert-banner` acima do conteúdo principal
- JS: `reviewAdminPushWithAi`, `sendAdminPush`, `loadAdminPushHistory`, `refreshPushAlerts`, `dismissWabaPushAlert`

### Correções de build

- Imports em `waba-admin-push.service.ts` apontando para `../push/`
- Template e-mail: `buildPushAnnouncementTemplate` retorna `{ subject, html }`

## Arquivos alterados/criados

- `src/push/*` (novo módulo)
- `src/admin/waba-admin-push.service.ts`
- `src/admin/waba-admin.routes.ts`
- `src/menus/waba-menu-registry.ts`
- `src/mail/waba-mail.templates.ts`
- `src/index.ts`
- `index.html`

## Como validar

1. `npm run build` — deve compilar sem erros
2. Login como master → Suporte → **Push**
3. Escrever mensagem → **Revisar com IA** (requer `OPENAI_API_KEY`)
4. Marcar destinos → **Enviar push**
5. Login como assinante/usuário operacional → banner de alerta no topo
6. Comunidade: instância `walkup` conectada; JID do grupo de Anúncios descoberto ou em `waba-push-config.json`

## Segurança

- Endpoints admin restritos a master (`rejectNonMaster`)
- Chaves OpenAI/SMTP apenas no backend
- Alertas filtrados por audience, role e `dismissedBy`

## Palavras-chave

`push`, `admin-push`, `suporte`, `openai`, `comunidade-whatsapp`, `walkup`, `alertas-in-app`, `waba-push-messages.json`
