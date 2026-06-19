# LOG — Aquecedor parâmetros recolhíveis (UI)

**Data:** 2026-06-19

## Pedido

Seção **Parâmetros** do Aquecedor deve ficar recolhida por padrão, com seta para expandir quando o usuário quiser salvar novas configurações. Interface mais limpa e intuitiva.

## Alterações

**Arquivo:** `index.html` (+ cópia `dist/index.html`)

- Painel `aquecedor-params-panel` com header clicável (chevron ▸ → ▾)
- Resumo compacto quando recolhido: expediente + janela/pausa/envio
- Badge **Padrão** / **Personalizado**
- Formulário + toggle + botão Salvar só visíveis expandidos
- Após salvar ou carregar config: recolhe automaticamente
- Texto introdutório orientando uso do motor vs parâmetros

**JS:** `updateAquecedorParamsSummary`, `setAquecedorEditMode` refatorado, `aquecedorEditMode` default `false`

## Validação

```bash
node scripts/copy-index-html.mjs
```

## Pendências

- Deploy Easypanel (HTML estático no serviço waba_disparador)
- Validar visual em mobile (ellipsis no resumo)
