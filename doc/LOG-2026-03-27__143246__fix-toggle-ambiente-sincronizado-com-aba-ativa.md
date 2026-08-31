# Contexto do pedido

Na carga da página, o seletor "Ambiente de integração" mostrava **API Meta** ativo enquanto o conteúdo exibido era o da API não oficial (ex.: Dashboard).

# Causa

- `localStorage` (`waba.integration.env`) era aplicado no toggle **antes** de `setActiveTab(activeTab)`.
- A aba inicial continua `dashboard`, gerando inconsistência entre toggle e tela.

# Solução

1. Removida a aplicação inicial do ambiente só a partir do `localStorage`.
2. Criada `syncIntegrationEnvWithTab(tabName)` que:
   - define o toggle e o rótulo conforme a aba (Meta vs não oficial);
   - persiste `waba.integration.env` alinhado à aba ativa.
3. Chamada de `syncIntegrationEnvWithTab(nextTab)` ao final de `setActiveTab`.

# Arquivos alterados

- `index.html`
- `dist/index.html` (build)

# Como validar

1. Limpar ou manter `localStorage`; abrir a raiz com Dashboard.
2. Confirmar toggle **API não oficial** ativo e texto do ambiente coerente.
3. Alternar para uma aba Meta pelo menu; confirmar **API Meta** ativo.
4. Voltar ao Dashboard; confirmar **API não oficial** ativo novamente.

# Palavras-chave

- integration-env-toggle-sync
- localStorage-waba-integration-env
- setActiveTab
