# LOG - create-aquecedor-config-page-and-api

## Contexto do pedido
Migrar a base de configuracao do Aquecedor do fluxo n8n para o sistema, deixando variaveis editaveis no frontend, com padrao recomendado habilitado por default e opcao de personalizacao.

## Acoes executadas
- Criado backend de configuracao do Aquecedor em `src/index.ts`.
- Criado motor operacional do Aquecedor no backend (start/stop/status/run-once).
- Criada interface da aba `Aquecedor` com formulario de variaveis e dicas "Melhor utilizar (...)".
- Implementado toggle "Usar padrao recomendado" com bloqueio/liberacao de campos.
- Implementado carregamento e salvamento da configuracao via API.
- Adicionado script SQL para criar/seed da tabela `aquecedor_config`.
- Build validado com sucesso.

## Solucao implementada
1. Backend:
   - `GET /aquecedor/config`
   - `POST /aquecedor/config`
   - `GET /aquecedor/status`
   - `POST /aquecedor/start`
   - `POST /aquecedor/stop`
   - `POST /aquecedor/run-once`
   - Validacoes de faixa e consistencia (janela inicial/final e wait min/max).
2. Frontend:
   - Controles de runtime (iniciar, parar e executar 1 ciclo).
   - Campos das variaveis principais do aquecimento.
   - Padrao recomendado inicial.
   - Alternancia entre modo recomendado e customizado.
3. Persistencia:
   - Tabela `aquecedor_config` (registro unico `id=1`) via Supabase.

## Arquivos alterados
- `src/index.ts`
- `index.html`
- `doc/SQL-2026-03-20__create-aquecedor-config.sql`

## Como validar
1. Executar SQL de criacao da tabela.
2. Abrir aba `Aquecedor`.
3. Confirmar que o padrao recomendado inicia habilitado.
4. Desabilitar o padrao, editar valores e salvar.
5. Reabrir aba e confirmar persistencia.

## Observacoes de seguranca
- Chave de service role permanece somente no backend.
- Entradas do formulario sao validadas no servidor.
- Nenhum segredo novo foi exposto no frontend.

## Palavras-chave
- aquecedor-config
- padrao-recomendado
- configuracao-customizada
- supabase-upsert
