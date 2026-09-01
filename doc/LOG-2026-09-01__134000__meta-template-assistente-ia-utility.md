# Assistente IA para templates Utility da Meta

## Contexto

Implementar no fluxo existente de templates um assistente que:

1. exige seleção do portfólio/WABA;
2. recebe um texto base simples;
3. avalia a finalidade real;
4. gera três versões com máxima aderência legítima a Utility;
5. mantém revisão e submissão humanas.

## Solução

- Usa as mesmas variáveis `OPENAI_API_KEY`, `OPENAI_MODEL` e `OPENAI_API_URL`.
- OpenAI Responses API com Structured Outputs (`strict: true`) e JSON Schema
  validado novamente com Ajv.
- Se a finalidade for Marketing, não gera versões Utility disfarçadas.
- Se elegível, retorna exatamente três opções BODY-only compatíveis com o
  validator Meta existente.
- Portfólio é obrigatório; conexão e WABA são verificadas dentro do tenant.
- Opção escolhida apenas preenche o formulário. O endpoint da IA não chama a Meta.
- As três opções são submetidas como templates distintos, em chamadas sequenciais;
  cada tentativa é vinculada à mesma análise para comparação posterior.
- Com confirmação humana, o sistema cadastra as três sequencialmente e informa
  sucesso/falha por opção. O filtro **Aprovados** mostra as aprovadas após sync.
- O filtro de status usa select compacto no tema escuro/ciano do Laboratório.
- WABAs `pending_confirmation` com token/WABA válidos podem gerar e gerenciar
  templates; a geração por IA não depende de número já confirmado para envio.
- Workspace em duas colunas: texto base + **Gerar** à esquerda; três opções +
  **Enviar para Meta** à direita. A Meta só é chamada no segundo botão.
- Rate limit por tenant/usuário, timeout, retry transitório e logs sem texto/segredos.
- Análise e três opções persistidas para posterior comparação com o status e
  categoria retornados pela Meta.

## Banco

Aplicar:

`doc/SQL-2026-09-01__create-meta-template-ai-analyses.sql`

## Arquivos principais

- `src/integrations/openai/waba-openai-responses.client.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.*`
- `src/integrations/meta-whatsapp/meta-whatsapp-template.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp.routes.ts`
- `index.html`

## Validação

```bash
npm run test:meta-template-ai
npm run test:meta-phase7
npm run test:meta-phase5
npm run build
```

Validar funcionalmente após migration/deploy:

- escolher Drax ou Walkup;
- informar texto operacional;
- receber três opções;
- aplicar uma;
- editar;
- clicar em Criar template;
- confirmar `PENDING` e depois categoria/status reais da Meta.

Preview local sem login/API real:

`/?ui-preview=template-ai`

## Segurança

- Chave OpenAI somente no backend.
- `store: false`.
- Nenhum modelo ou limite de tokens controlado pelo frontend.
- Sem envio automático à Meta.
- Queries filtradas por `tenant_id` e `connection_id`.

## Referências oficiais

- https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/
- https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/
- https://platform.openai.com/docs/guides/structured-outputs

## Palavras-chave

template Utility, OpenAI Structured Outputs, três opções, portfólio, human-in-the-loop
