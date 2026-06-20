# LOG — V02 abas topo + menu Créditos

**Data:** 2026-06-19  
**Pedido:** Ambiente 02 — 3 abas no topo (Aquecedor / API Oficial / API Alternativa); menu lateral «Disparos» → «Créditos» com ícone carrinho.

## Alterações

### `index.html`
- Terceiro botão `data-integration-env="alternativa"` na faixa superior (visível só em `waba-ui-production`)
- CSS: estados `integration-env-alternativa`, responsivo 3 abas
- Menu lateral `disparos-lancamento`: label **Créditos** + SVG carrinho (desktop e mobile)
- JS: `normalizeIntegrationEnv`, `selectDisparosApiKind`, `syncProductionIntegrationStripLabels`
- `applyIntegrationEnvironment` / clique nas abas: suporte oficial + alternativa; persiste `waba.integration.env` e `waba.disparos.api-choice`

### `src/menus/waba-menu-registry.ts`
- `disparos-lancamento.label` → **Créditos**

## Validação
- `node` parse do script inline → syntax ok
- V01 baseline inalterado (3ª aba permanece `hidden`)

## Próximo passo
- Reiniciar `npm run dev:v02` e Ctrl+F5 em http://localhost:3012/version-02/ (ou porta configurada)
