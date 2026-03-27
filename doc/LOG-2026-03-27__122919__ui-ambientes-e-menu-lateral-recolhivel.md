# Contexto do pedido

Usuário solicitou evolução visual para diferenciar dois ambientes de operação:
- ambiente sem API oficial;
- ambiente com API oficial.

Também solicitou menu lateral com possibilidade de recolher, iniciando recolhido por padrão.

# Comandos e ações executadas

1. Inspeção de `index.html` (estrutura de tabs e scripts).
2. Implementação de:
   - faixa visual de ambiente com alternância entre `Não oficial` e `API oficial`;
   - menu lateral desktop recolhível com estado inicial recolhido;
   - persistência de preferências via `localStorage`.
3. Build:
   - `npm run build`
4. Verificação de lint:
   - `ReadLints` em `index.html` sem erros.

# Solução implementada (passo a passo)

1. Faixa de ambiente (`integration-env-strip`) adicionada abaixo do header.
2. Botões de ambiente:
   - `data-integration-env="nao-oficial"`
   - `data-integration-env="oficial"`
3. Estado visual do ambiente:
   - classe `integration-env-official` no `body` para tema oficial.
4. Conversão do bloco de tabs em sidebar desktop:
   - comportamento fixo lateral para telas >= 992px;
   - botão `sidebar-toggle` para expandir/recolher.
5. Estado inicial do menu:
   - recolhido por padrão (`waba.sidebar.collapsed`).
6. Persistência:
   - `waba.sidebar.collapsed` e `waba.integration.env` no `localStorage`.
7. Atualização de botões de navegação desktop com ícone + label para melhor leitura em modo expandido e colapsado.

# Arquivos criados/alterados

- `index.html` (alterado)
- `dist/index.html` (atualizado via build)
- `doc/LOG-2026-03-27__122919__ui-ambientes-e-menu-lateral-recolhivel.md` (novo)

# Como validar

1. Abrir a aplicação em desktop.
2. Verificar:
   - menu lateral aparece recolhido por padrão;
   - botão do menu alterna entre expandido/recolhido;
   - tabs continuam trocando de tela normalmente.
3. Verificar faixa de ambiente:
   - alternar entre `Não oficial` e `API oficial`;
   - observar mudança visual do bloco e do destaque do menu.
4. Recarregar a página e confirmar persistência:
   - estado do menu e ambiente permanecem.
5. Em mobile:
   - manter funcionamento do menu hambúrguer já existente.

# Observações de segurança

- Alteração estritamente visual/front-end.
- Nenhuma credencial, token ou endpoint sensível foi alterado.
- Não houve impacto na lógica de envios em background.

# Itens para evitar duplicação no futuro (palavras-chave)

- ambiente-nao-oficial
- ambiente-api-oficial
- sidebar-recolhivel
- menu-lateral-colapsado
- localstorage-ui-state
