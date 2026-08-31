# Ícone foguinho laranja no nome Aquecedor

## Contexto

Mesmo padrão de API Oficial/Alternativa: onde aparecer **Aquecedor** como nome do produto, acompanhar ícone de chama laranja (`#fb923c`), igual ao menu lateral.

## Solução

- CSS `.waba-aquecedor-label` + `.flame-icon` (stroke laranja).
- Helpers: `renderWabaAquecedorLabelHtml`, `renderTextWithAquecedorIconHtml`, `setWabaAquecedorLabelElement`, `enhanceWabaAquecedorLabelElements`.
- `enhanceWabaProductLabelElements` unifica API + Aquecedor no boot.
- Strip de ambiente: botão e indicador atual com SVG de chama.
- Painel, menu mobile, grupo lateral, botões Iniciar/Pausar, hero de runtime, aba «Instâncias do Aquecedor», título do chat simulado.
- `#tab-btn-aquecedor .tab-icon svg` com cor laranja.

## Exceções

- Baseline UI mantém «API não oficial» sem ícone de Aquecedor.
- Toasts/mensagens de erro em string pura.

## Arquivos

- `index.html`, `dist/index.html`

## Palavras-chave

`waba-aquecedor-label`, `flame-icon`, `data-waba-aquecedor-label`, Aquecedor ícone laranja
