# Contexto do pedido

Usuário solicitou manter Aquecedor e Campanhas em execução enquanto continua o desenvolvimento de novos recursos, sem causar falhas no processamento atual.

# Comandos e ações executadas

1. Análise de scripts e bootstrap do servidor:
   - leitura de `package.json`
   - leitura de `src/index.ts`
2. Implementação de isolamento de runtime no backend:
   - inclusão de variáveis de ambiente para modo e processamento em background
   - proteção de inicialização do aquecedor em runtime sem processamento
   - proteção do endpoint `/aquecedor/start` em runtime sem processamento
   - proteção do tick automático de campanhas
3. Criação de scripts de execução separados:
   - `npm run start:prod`
   - `npm run dev:isolado`
4. Build e validação:
   - `npm run build`
   - checagem de lint sem erros em arquivos alterados

# Solução implementada (passo a passo)

1. Adicionadas flags de runtime:
   - `RUNTIME_MODE` (default: `production`)
   - `ENABLE_BACKGROUND_PROCESSING` (default: `true`)
2. Ajustado `startAquecedorRuntime()`:
   - quando `ENABLE_BACKGROUND_PROCESSING=false`, não inicia ciclo e retorna status seguro.
3. Ajustado endpoint `POST /aquecedor/start`:
   - retorna `409` com mensagem explícita quando o processo está em modo isolado (sem processamento).
4. Ajustado bootstrap (`app.listen`):
   - o `setInterval` de `runCampaignDispatchTick` só roda quando `ENABLE_BACKGROUND_PROCESSING=true`.
   - logs de runtime adicionados para facilitar observabilidade.
5. Scripts do `package.json`:
   - `start:prod`: porta 3000 + processamento habilitado.
   - `dev:isolado`: porta 3010 + processamento desabilitado.

# Arquivos criados/alterados

- `src/index.ts` (alterado)
- `package.json` (alterado)
- `doc/LOG-2026-03-27__120918__isolamento-runtime-producao-dev-sem-interromper-envios.md` (novo)

# Como validar

1. Produção estável:
   - `npm run build`
   - `npm run start:prod`
   - validar logs com `backgroundProcessing=true`
2. Desenvolvimento isolado (outro terminal):
   - `npm run dev:isolado`
   - validar logs com `backgroundProcessing=false`
3. Confirmar comportamento:
   - processo dev não executa tick automático de campanhas
   - `/aquecedor/start` no dev retorna bloqueio controlado (`409`)
   - produção continua processando normalmente

# Observações de segurança

- Evita disparo duplicado por execução paralela de runtimes.
- Isolamento reduz risco operacional durante desenvolvimento.
- Nenhuma chave/segredo foi exposto.

# Itens para evitar duplicação no futuro (palavras-chave)

- runtime-isolado
- enable-background-processing
- dev-isolado-3010
- start-prod-3000
- evitar-disparo-duplicado
