# Contexto do pedido

Usuário solicitou deixar as 3 fases da trilha da API oficial prontas para subir e testar:
1. Ativos API (já iniciada)
2. Templates utilidade
3. Disparo via API oficial

# Comandos e ações executadas

1. Implementação backend em `src/index.ts`:
   - listagem de templates
   - criação de template utilidade
   - disparo de template via Cloud API
2. Implementação frontend em `index.html`:
   - Fase 2 com formulário funcional + listagem
   - Fase 3 com formulário funcional + log de envio
3. Build:
   - `npm run build`
4. Correção de tipagem TypeScript:
   - ajuste do `map` de parâmetros (`text: string`)
5. Validação:
   - `ReadLints` sem erros.

# Solução implementada (passo a passo)

## Backend (Meta oficial)

### Fase 2 — Templates utilidade
- `POST /meta-oficial/templates/list`
  - Entrada: `token`, `wabaId`, `limit`
  - Ação: `GET /{wabaId}/message_templates`
- `POST /meta-oficial/templates/create-utility`
  - Entrada: `token`, `wabaId`, `name`, `language`, `bodyText`
  - Ação: `POST /{wabaId}/message_templates`
  - Payload com categoria `UTILITY` e componente `BODY`.

### Fase 3 — Disparo API
- `POST /meta-oficial/disparo/send-template`
  - Entrada: `token`, `phoneNumberId`, `to`, `templateName`, `languageCode`, `bodyParams[]`
  - Ação: `POST /{phoneNumberId}/messages`
  - Envio de mensagem tipo `template`.

## Frontend (Fase 2 e 3)

### Fase 2 — tela funcional
- Campos:
  - nome do template
  - idioma
  - texto BODY
- Ações:
  - criar template utilidade
  - listar templates
- Painel de resultado com status dos templates.

### Fase 3 — tela funcional
- Campos:
  - `phone_number_id`
  - número destino
  - nome do template
  - idioma
  - parâmetros de BODY (`;` separado)
- Ação:
  - enviar template via API Meta
- Log incremental de envios com `message_id` quando disponível.

# Arquivos criados/alterados

- `src/index.ts` (alterado)
- `index.html` (alterado)
- `dist/index.html` (atualizado via build)
- `doc/LOG-2026-03-27__135341__fase2-fase3-meta-api-prontas-end-to-end.md` (novo)

# Como validar

1. Subir ambiente e abrir menus:
   - `1) Ativos API`
   - `2) Templates`
   - `3) Disparo API`
2. Fase 1:
   - token + WABA ID
   - listar números e apps inscritos
3. Fase 2:
   - criar template utilidade
   - listar templates e conferir status
4. Fase 3:
   - enviar template para número de teste
   - conferir retorno e log de envio

# Observações de segurança

- Token da Meta não é persistido no backend (uso sob demanda).
- Entradas críticas validadas no servidor.
- Erros retornados com detalhe reduzido (sem expor conteúdo sensível).

# Itens para evitar duplicação no futuro (palavras-chave)

- meta-fase2-templates
- meta-fase3-disparo
- cloud-api-send-template
- message_templates-utility
