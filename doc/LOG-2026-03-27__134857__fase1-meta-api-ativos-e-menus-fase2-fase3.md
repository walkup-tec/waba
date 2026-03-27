# Contexto do pedido

Usuário iniciou desenvolvimento da trilha de API oficial (Meta), enviou fluxo n8n de referência e definiu 3 fases/menus:
1. Criação de Ativos (app, integração API oficial, integração de números)
2. Criação de modelo de mensagem (utilidade)
3. Disparo de mensagens via API oficial

# Comandos e ações executadas

1. Estudo das docs oficiais da Meta (Cloud API/messages/templates/get-started).
2. Implementação backend (`src/index.ts`) para fase de ativos:
   - listar números do WABA;
   - registrar número (phone_number_id + pin);
   - listar apps inscritos;
   - garantir inscrição do app em `subscribed_apps`.
3. Implementação frontend (`index.html`):
   - novos menus/tabs da trilha oficial:
     - `1) Ativos API`
     - `2) Templates`
     - `3) Disparo API`
   - nova tela `Fase 1` funcional com campos e ações.
   - telas `Fase 2` e `Fase 3` como placeholders estruturados para próxima implementação.
4. Build e validação:
   - `npm run build`
   - `ReadLints` sem erros.

# Solução implementada (passo a passo)

## Backend (Fase 1)

### Helper de integração Meta Graph
- `callMetaGraphApi` com:
  - token Bearer obrigatório;
  - timeout de 12s;
  - retry para erros transitórios (429/5xx);
  - retorno padronizado (`ok/status/json/body`).

### Endpoints criados
- `POST /meta-oficial/ativos/phone-numbers/list`
  - entrada: `token`, `wabaId` (ou `id_bm`)
  - ação: `GET /{wabaId}/phone_numbers`
- `POST /meta-oficial/ativos/phone-numbers/register`
  - entrada: `token`, `phoneNumberId`, `pin`
  - ação: `POST /{phoneNumberId}/register` com `{ messaging_product: "whatsapp", pin }`
- `POST /meta-oficial/ativos/subscribed-apps/list`
  - entrada: `token`, `wabaId` (ou `id_bm`)
  - ação: `GET /{wabaId}/subscribed_apps`
- `POST /meta-oficial/ativos/subscribed-apps/ensure`
  - entrada: `token`, `wabaId`
  - ação:
    1. consulta `subscribed_apps`
    2. se vazio, executa `POST /{wabaId}/subscribed_apps` com `subscribed_fields`.

## Frontend (menus e fase 1)

- Menu lateral (API Meta) recebeu 3 novos menus da trilha oficial.
- Menu mobile recebeu os mesmos itens.
- Nova aba `Fase 1` com:
  - guia de criação de app (link oficial Meta),
  - campos de token + WABA ID,
  - ações para listar números e apps inscritos,
  - integração de número com `phone_number_id` + `PIN`,
  - ação para garantir inscrição de app.
- Novas abas `Fase 2` e `Fase 3` estruturadas para evolução.

# Arquivos criados/alterados

- `src/index.ts` (alterado)
- `index.html` (alterado)
- `dist/index.html` (atualizado via build)
- `doc/LOG-2026-03-27__134857__fase1-meta-api-ativos-e-menus-fase2-fase3.md` (novo)

# Como validar

1. Abrir sistema no ambiente dev.
2. No menu lateral, abrir:
   - `1) Ativos API`
3. Preencher:
   - token Meta (System User)
   - WABA ID
4. Testar botões:
   - `Listar números do WABA`
   - `Ver apps inscritos`
   - `Registrar número`
   - `Inscrever app (subscribed_apps)`
5. Confirmar mensagens de status e carregamento no painel.

# Observações de segurança

- Token não é persistido em backend; uso sob demanda no request.
- Não há logging explícito de token.
- Validações mínimas aplicadas para campos críticos (`token`, `wabaId`, `phoneNumberId`, `pin`).

# Itens para evitar duplicação no futuro (palavras-chave)

- meta-oficial-fase1
- phone-numbers-register
- subscribed-apps-ensure
- menu-fase2-template-utility
- menu-fase3-disparo-api
