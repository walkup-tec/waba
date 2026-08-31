# LOG - Disparos e regras operacionais

## Contexto do pedido

Implementar a página `Disparos` com foco em UX/UI e base backend para:

- fallback entre instâncias quando número bloquear/desconectar;
- seleção por instância para uso em `Aquecedor` e `Disparador`;
- variáveis do orquestrador;
- modo de mensagem por IA ou base importada de planilha;
- encurtador de URL gratuito.

## Ações executadas

1. Criação e evolução de layout da aba `Disparos`.
2. Inclusão de controles de uso por instância na aba `Instâncias`.
3. Criação de endpoints backend para:
   - configuração de uso por instância;
   - configuração do disparador;
   - seleção de próxima instância para fallback;
   - encurtamento de URL por provedores gratuitos;
   - importação e listagem de templates de mensagens.
4. Ajuste do aquecedor para respeitar instâncias habilitadas para aquecimento.
5. Implementação de fluxo de importação de planilha com mapeamento de colunas no frontend.
6. Build e validação (`npm run build`).

## Solução implementada (passo a passo)

### Frontend (`index.html`)

- Aba `Disparos` ganhou formulário completo com:
  - lock TTL, delays, limites por hora/dia, janela por dia/hora;
  - seleção de modo (`IA` / `Base de mensagens`);
  - campos de briefing IA (tom, público, CTA e instruções);
  - seleção de provedor de encurtador e teste de encurtamento;
  - upload de planilha e mapeamento de colunas (mensagem, alias, segmento).
- Criado modal de mapeamento de planilha.
- Carregamento do parser XLSX via CDN.
- Integração com endpoints novos (`/disparos/*`, `/instancias/uso-config`).
- Aba `Instâncias` ganhou dois toggles por linha:
  - `Aquecedor`
  - `Disparador`

### Backend (`src/index.ts`)

- Novos tipos e defaults para configuração do disparador.
- Persistência (com fallback em memória) de uso de instâncias:
  - `GET /instancias/uso-config`
  - `POST /instancias/uso-config`
- Aquecedor passou a filtrar instâncias por `useAquecedor`.
- Novos endpoints do disparador:
  - `GET /disparos/config`
  - `POST /disparos/config`
  - `POST /disparos/shorten` (CleanURI, is.gd, TinyURL com token)
  - `GET /disparos/next-instance` (round-robin entre instâncias conectadas e habilitadas para disparador)
  - `GET /disparos/templates`
  - `POST /disparos/templates/import`

## Arquivos alterados

- `index.html`
- `src/index.ts`

## Como validar

1. Rodar `npm run build`.
2. Rodar `npm start`.
3. Abrir aba `Instâncias` e marcar/desmarcar `Aquecedor`/`Disparador`.
4. Abrir aba `Disparos`:
   - editar e salvar configuração;
   - testar encurtador;
   - subir planilha e mapear colunas;
   - confirmar importação de templates.
5. Chamar `GET /disparos/next-instance` e verificar seleção apenas de instâncias conectadas e habilitadas.

## Observações de segurança

- Não houve exposição adicional de segredos no frontend.
- TinyURL usa token via `TINYURL_API_TOKEN` em ambiente de backend.
- Endpoints retornam mensagens seguras sem detalhes internos sensíveis.

## Palavras-chave para evitar duplicação

- disparos-config
- instance-roles-aquecedor-disparador
- fallback-next-instance
- shortener-cleanuri-isgd-tinyurl
- import-planilha-mapeamento
