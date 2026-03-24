# Log: Integracao OpenAI para geracao e teste de mensagem

## Contexto do pedido
Adicionar integracao com OpenAI para gerar mensagem automaticamente no mensageiro e validar rapidamente se o fluxo gerou/enviou corretamente.

## Comandos / acoes executadas
- Leitura e analise do backend em `src/index.ts`
- Implementacao de endpoints de geracao e teste
- `npm run build`
- Verificacao de lints em `src/index.ts`

## Solucao implementada (passo a passo)
1. Adicionada configuracao OpenAI por ambiente:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` (default: `gpt-5-nano`)
   - `OPENAI_API_URL` (default: `https://api.openai.com/v1/responses`)
2. Criada funcao de prompt estruturado para Disparos:
   - `buildDisparosAiPrompt(...)`
   - Usa briefing, tom, publico, CTA e objetivo.
3. Criada extracao resiliente de texto de resposta:
   - `extractOpenAiText(...)`
   - Suporta `output_text` e formato por `output[].content[]`.
4. Criado client de integracao OpenAI com resiliencia:
   - `callOpenAiGenerateMessage(...)`
   - Timeout (15s), retries com backoff + jitter para erros transitivos (429/502/503/504), sem log de segredo.
5. Novo endpoint de geracao:
   - `POST /disparos/gerar-mensagem-ai`
   - Gera texto via OpenAI usando configuracao salva do Disparador (com override opcional no body).
6. Novo endpoint de teste ponta a ponta:
   - `POST /disparos/teste-mensagem-ai`
   - Gera mensagem via OpenAI e envia via EVO (`sendText`) para numero alvo e instancia informados.

## Arquivos criados/alterados
- Alterado: `src/index.ts`
- Criado: `doc/LOG-2026-03-24__105232__integracao-openai-geracao-e-teste-mensagem-disparos.md`

## Como validar
1. Definir variaveis no ambiente do backend:
   - `OPENAI_API_KEY=<sua_chave>`
   - (opcional) `OPENAI_MODEL=gpt-5-nano`
2. Executar build e subir servidor:
   - `npm run build`
   - `npm start` (ou `npm run dev`)
3. Testar geracao:
   - `POST /disparos/gerar-mensagem-ai`
   - body opcional: `briefing`, `tone`, `audience`, `cta`, `objective`, `model`
4. Testar geracao + envio:
   - `POST /disparos/teste-mensagem-ai`
   - body: `instanceName`, `targetNumber` (com DDD), opcionais de prompt/model
5. Confirmar entrega no WhatsApp da instancia.

## Observacoes de seguranca
- Chave OpenAI consumida apenas por variavel de ambiente.
- Nenhuma chave/token foi hardcoded no codigo.
- Fluxos de erro retornam mensagem segura sem expor credenciais.

## Itens para evitar duplicacao no futuro (palavras-chave)
- openai-responses-api
- disparos-gerar-mensagem-ai
- disparos-teste-mensagem-ai
- evo-sendtext
- retry-timeout-jitter
