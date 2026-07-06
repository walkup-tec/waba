# Ícones API Oficial / API Alternativa em todo o sistema

## Contexto

Pedido do usuário: em qualquer lugar do sistema onde aparecer **API Oficial** ou **API Alternativa**, os rótulos devem vir acompanhados dos ícones já usados no strip de ambiente (WhatsApp verde / foguete azul).

## Solução

1. **CSS** — classe global `.waba-api-label` com ícones `.wa-icon` (verde `#22c55e`) e `.rocket-icon` (azul `#38bdf8`); tamanhos ajustados em cards de compra, tags de campanha e histórico.
2. **Helpers JS** em `index.html`:
   - `normalizeWabaApiKind`, `formatWabaApiKindLabel`
   - `renderWabaApiKindLabelHtml`, `setWabaApiKindLabelElement`
   - `enhanceWabaApiKindLabelElements` para slots `[data-waba-api-kind]`
3. **HTML estático** — slots `data-waba-api-kind` em créditos (saldo), resumo disparos, wizard, menu mobile; foguete no card de compra Alternativa.
4. **Render dinâmico** — admin financeiro, pedidos, split, campanhas, histórico compras/bonificações, comparativo dashboard, modais de preço/PIX, tags de intake, hints operacionais e subtítulo do hub de créditos.
5. **Init** — `enhanceWabaApiKindLabelElements(document)` em `initUiProfile`, `initBaselineUi` e após boot da UI.

## Exceções intencionais

- `<option>` nativos em `<select>` — sem suporte a ícones; texto plano mantido.
- Toasts e mensagens de erro em string pura — texto sem ícone (não há elemento HTML).

## Arquivos alterados

- `index.html`
- `dist/index.html` (via `npm run build`)

## Validação

```bash
npm run build
```

Conferir visualmente: strip de ambiente, Créditos (Contratar + Histórico), campanhas, admin financeiro, modais Contratar/PIX, menu mobile.

## Palavras-chave

`waba-api-label`, `renderWabaApiKindLabelHtml`, `data-waba-api-kind`, ícones API Oficial Alternativa
