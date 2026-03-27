# Contexto do pedido

Usuário corrigiu a estrutura esperada do menu:
- manter apenas `API Meta` no menu lateral;
- por enquanto sem nova subdivisão para outros ambientes;
- todos os menus atuais devem ficar dentro de `API Meta`.

# Comandos e ações executadas

1. Ajuste do `index.html`:
   - remoção do grupo `API não oficial` da navegação desktop;
   - movimentação/centralização de todos os menus existentes para o grupo `API Meta`.
2. Ajuste de lógica JS:
   - simplificação do controle de abertura automática para manter apenas o grupo `API Meta`.
3. Build:
   - `npm run build`
4. Validação:
   - `ReadLints` em `index.html` sem erros.

# Solução implementada (passo a passo)

1. Sidebar desktop passou a ter um único dropdown:
   - `API Meta`
2. Itens dentro de `API Meta`:
   - Dashboard
   - Instâncias
   - Aquecedor
   - Disparos
3. Removida a dependência de alternância entre grupos `oficial` e `nao-oficial` no menu lateral.

# Arquivos criados/alterados

- `index.html` (alterado)
- `dist/index.html` (atualizado via build)
- `doc/LOG-2026-03-27__132420__menu-lateral-apenas-api-meta-todos-menus.md` (novo)

# Como validar

1. Abrir a aplicação em desktop.
2. Conferir que o menu lateral exibe apenas o grupo `API Meta`.
3. Confirmar que os 4 menus atuais estão nesse grupo e funcionando normalmente.

# Observações de segurança

- Mudança exclusivamente visual/navegação frontend.
- Nenhum impacto em lógica de disparo, aquecedor, integrações ou credenciais.

# Itens para evitar duplicação no futuro (palavras-chave)

- sidebar-apenas-api-meta
- dropdown-unico
- todos-menus-em-api-meta
