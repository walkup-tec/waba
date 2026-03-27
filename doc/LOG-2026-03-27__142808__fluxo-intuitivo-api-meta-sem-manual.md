# Contexto do pedido

Usuário solicitou remover dependência de manual/documentação externa e tornar o fluxo da API Meta intuitivo para usuários sem familiaridade técnica.

# Comandos e ações executadas

1. Removida orientação que dependia de leitura de guia externo no bloco de criação de app.
2. Implementados botões de execução automática por etapa:
   - etapa 2 automática (validar conexão + listar dados)
   - etapa 3 automática (registrar número + garantir inscrição)
3. Integração com checklist já existente para marcar progresso automaticamente.
4. Build:
   - `npm run build`
5. Validação:
   - `ReadLints` em `index.html` sem erros.

# Solução implementada (passo a passo)

1. Texto da etapa 1 reescrito em linguagem simples, sem link/manual externo.
2. Adicionado botão `Executar etapa 2 automaticamente`:
   - lista números do WABA
   - consulta apps inscritos
   - preenche `phone_number_id` automaticamente quando possível
3. Adicionado botão `Finalizar ativação automaticamente`:
   - registra número (`register`)
   - garante inscrição do app em `subscribed_apps`
4. Status da etapa atualizado com mensagens diretas e orientadas por ação.
5. Checklist de validação atualizado conforme cada passo concluído.

# Arquivos criados/alterados

- `index.html` (alterado)
- `dist/index.html` (atualizado via build)
- `doc/LOG-2026-03-27__142808__fluxo-intuitivo-api-meta-sem-manual.md` (novo)

# Como validar

1. Abrir `API Meta` > `1) Ativos API`.
2. Preencher `Token` e `WABA ID`.
3. Clicar em:
   - `Executar etapa 2 automaticamente`
   - `Finalizar ativação automaticamente`
4. Conferir:
   - status com mensagens claras de sucesso/erro
   - checklist marcando itens concluídos.

# Observações de segurança

- Nenhum token é persistido no backend.
- Fluxo guiado reduz risco operacional por erro manual de ordem de passos.
- Mensagens de erro mantidas com detalhe controlado.

# Itens para evitar duplicação no futuro (palavras-chave)

- fluxo-intuitivo-meta
- etapa-automatica-api-meta
- sem-manual-usuario-final
- onboarding-simplificado
