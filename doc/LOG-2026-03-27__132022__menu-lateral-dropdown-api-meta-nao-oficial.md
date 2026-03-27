# Contexto do pedido

Usuário solicitou no menu lateral a separação por dropdown entre itens pertencentes à `API Meta` e à `API não oficial`.

# Comandos e ações executadas

1. Alteração de `index.html` para:
   - criar grupos dropdown no menu lateral desktop;
   - separar itens por contexto de API;
   - conectar abertura dos grupos com seletor de ambiente de integração.
2. Build:
   - `npm run build`
3. Validação:
   - `ReadLints` em `index.html` sem erros.

# Solução implementada (passo a passo)

1. Navegação desktop reorganizada em dois grupos:
   - `API Meta`:
     - Dashboard
     - Instâncias
   - `API não oficial`:
     - Aquecedor
     - Disparos
2. Cada grupo recebeu botão de expansão/retração (`dropdown`) com caret.
3. Ao alternar ambiente de integração:
   - em `API Meta`: grupo `API Meta` abre e `API não oficial` recolhe;
   - em `API não oficial`: grupo `API não oficial` abre e `API Meta` recolhe.
4. Mantida navegação mobile existente sem alteração estrutural.

# Arquivos criados/alterados

- `index.html` (alterado)
- `dist/index.html` (atualizado via build)
- `doc/LOG-2026-03-27__132022__menu-lateral-dropdown-api-meta-nao-oficial.md` (novo)

# Como validar

1. Em desktop, abrir/fechar o menu lateral e verificar os dois grupos dropdown.
2. Trocar o ambiente no seletor:
   - `API Meta` -> grupo Meta aberto;
   - `API não oficial` -> grupo não oficial aberto.
3. Clicar nas abas e confirmar navegação normal entre painéis.

# Observações de segurança

- Mudança somente de UI/UX (frontend).
- Nenhuma alteração em chaves, integrações sensíveis ou lógica de processamento de envios.

# Itens para evitar duplicação no futuro (palavras-chave)

- sidebar-dropdown-groups
- menu-api-meta
- menu-api-nao-oficial
- tabs-por-ambiente
