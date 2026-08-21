## Contexto
Botão **“Aquecer”** no **Device Cloud** estava com o ícone **muito distante** do texto e não estava seguindo a cor laranja padrão usada no aquecedor.

## Objetivo
Ajustar alinhamento (gap) do ícone + texto e aplicar a cor laranja (`#fb923c`) somente no botão do Device Cloud `#device-cloud-warm-btn`.

## Solução implementada
No bundle do Device Cloud (`dist/index.html`), adicionei overrides de CSS específicos para o botão:
- `.device-cloud-warm-btn .waba-aquecedor-label { gap: 4px; }`
- `.device-cloud-warm-btn .waba-aquecedor-label-text { color: #fb923c; }`

## Arquivos criados/alterados
- Criado: `doc/LOG-2026-08-19__112149__device-cloud-warm-btn-icon-orange-fix.md`
- Alterado: `dist/index.html` (no worktree `.tmp-wt-aquecedor-6635`)

## Como validar
1. Recarregar a aba **“Dispositivos”** no Device Cloud.
2. Confirmar que o botão **Aquecer** exibe ícone e texto com espaçamento correto e texto laranja.

## Observações de segurança
Sem inclusão de segredos/tokens.

## Palavras-chave (para evitar duplicação)
device-cloud, aquecedor, aquecer, button, css-gap, flame-icon, #fb923c

