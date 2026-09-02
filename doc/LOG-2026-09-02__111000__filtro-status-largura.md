# LOG — Filtro Todos os status cortado

## Contexto

O select de status da tabela de templates mostrava “Todos os stat” — o texto “Todos os status” não cabia.

## Correção

`.meta-tpl-status-filter` passou de `132px` para `176px` (`min-width` + `flex: 0 0 auto`), com `box-sizing: border-box`, para o padding da seta nativa não comer o rótulo.

## Como validar

Na tabela de templates, o filtro deve ler **Todos os status** por inteiro, sem cortar no ícone.

Marker: `DEPLOY-2026-09-02-111000-filtro-status-largura`

## Palavras-chave

filtro, status, select, largura, Todos os status, tabela templates
