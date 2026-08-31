# LOG — Validação obrigatória para salvar configurações

## Contexto

Solicitação para impedir salvamento de configurações quando houver campos do painel sem informação.

## Ações executadas

1. Frontend (`index.html`):
   - Aquecedor: criada validação de campos obrigatórios antes de `saveAquecedorConfig`.
   - Disparador: criada validação de campos obrigatórios antes de `saveDisparosConfig`, incluindo:
     - temporizador, limites, janela, WhatsApp;
     - ao menos uma instância selecionada;
     - ao menos um dia de expediente;
     - campos do modo IA quando o modo ativo é IA.
2. Backend (`src/index.ts`):
   - criado `validateRequiredDisparosConfigPayload`.
   - endpoint `POST /disparos/config` agora retorna `400` para payload incompleto (não aceita salvar faltando informação mínima).
3. Build e atualização dos ambientes:
   - `npm run build` executado;
   - reinício dos ambientes `3000` (`start:prod`) e `3010` (`dev:isolado`).

## Arquivos alterados

- `index.html`
- `src/index.ts`
- `dist/index.html` (gerado)
- `dist/index.js` (gerado)

## Validação

- API testada com payload incompleto em `/disparos/config`: retorno de erro `400` com mensagem de campo obrigatório ausente.
- Portas ativas após reinício:
  - `http://localhost:3000`
  - `http://localhost:3010`

## Segurança

- Sem exposição de segredos.
- Validação no backend evita bypass de validação de UI.

## Palavras-chave

`saveDisparosConfig`, `saveAquecedorConfig`, `validateRequiredDisparosConfigPayload`, campos-obrigatorios, bloqueio-salvar
