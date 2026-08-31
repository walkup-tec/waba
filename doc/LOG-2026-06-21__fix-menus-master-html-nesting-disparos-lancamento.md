# LOG — Fix menus master sem conteúdo (HTML nesting)

**Data:** 2026-06-21  
**Contexto:** Usuário master `walkup@walkuptec.com.br` clicava em API Oficial, API Alternativa, Disparos, ADMIN e Suporte — telas ficavam vazias.

## Causa raiz

Após merge do tarifador (layout `disparos-pricing-lanes`), a seção `#tab-disparos-lancamento` ficou com **`</div>` faltando/extra**. Painéis seguintes ficaram **aninhados dentro** de `tab-disparos-lancamento`:

- `tab-disparos`
- `tab-meta-*`
- `tab-admin-*`

O `setActiveTab` removia `tab-hidden` do painel alvo, mas o pai `tab-disparos-lancamento` permanecia com `tab-hidden` → conteúdo invisível.

## Diagnóstico

Scripts em `agent-tools/`:

- `check-tab-nesting.mjs` — confirmou `tab-admin-dashboard ancestors: tab-disparos-lancamento`
- `trace-div-depth.mjs` — depth 2 antes de `tab-disparos` (esperado 0)

## Correção

Em `index.html`:

1. Fechar `</div>` de `.disparos-pricing-lanes` após os dois `<article>` de pricing.
2. Fechar `choice-wrap` e `hub-panel-purchase` antes do painel de histórico.
3. Fechar `disparos-credits-scene` e `tab-disparos-lancamento` antes de `tab-disparos`.

## Arquivos alterados

- `index.html`
- `dist/index.html` (via `npm run build`)

## Validação

```bash
node agent-tools/trace-div-depth.mjs   # final depth 0 antes tab-disparos
node agent-tools/check-tab-nesting.mjs # todos painéis top-level em main
npm run build
```

No browser (master): clicar Disparos, API Oficial/Alternativa, ADMIN e Suporte — painéis devem aparecer.

## Palavras-chave

`tab-disparos-lancamento`, `setActiveTab`, `tab-hidden`, HTML nesting, menus master vazios, `disparos-pricing-lanes`
