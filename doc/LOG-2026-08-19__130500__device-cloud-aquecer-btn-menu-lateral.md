# Device Cloud — botão Aquecer alinhado ao menu lateral Aquecedor

## Contexto

O botão **Aquecer** no Device Cloud estava com override escuro/cobre (`#231f20`, `#d68d54`) que não correspondia ao menu lateral **Aquecedor**. Pedido: copiar os mesmos parâmetros CSS da aba `#tab-btn-aquecedor` ativa no grupo `nao-oficial`.

## Solução

Substituído o bloco `.device-cloud-warm-btn` em `index.html` pelos valores usados em:

- `.menu-group[data-menu-group="nao-oficial"]` → `--menu-section-accent-rgb: 251, 146, 60`
- `.menu-group[data-menu-group] .tab-button.active` → borda/fundo/texto
- `#tab-btn-aquecedor .tab-icon svg` → ícone `#fb923c`
- `.desktop-tabs .tab-button` → padding `10px 12px`, `border-radius: 10px`, `gap: 8px`

## Arquivos alterados

- `index.html` — CSS `.device-cloud-warm-btn`

## Como validar

1. Abrir aba **Dispositivos** (Device Cloud).
2. Ctrl+F5 após deploy.
3. Botão **Aquecer** deve ter fundo `rgba(251,146,60,0.14)`, borda laranja suave, texto `#f8fafc`, chama `#fb923c` — igual à aba Aquecedor ativa no menu lateral.

## Palavras-chave

`device-cloud`, `aquecer`, `tab-btn-aquecedor`, `menu-section-accent-rgb`, `nao-oficial`
