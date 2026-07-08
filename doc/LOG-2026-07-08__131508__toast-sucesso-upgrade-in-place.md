# LOG — 2026-07-08 13:15 — Toast sucesso reenviar (upgrade in-place)

## Pedido
Toast **"Mensagem de boas-vindas reenviada no WhatsApp e e-mail"** ainda não aparecia após reenvio (e-mail+WhatsApp `sent` no servidor; feedback "Reenviando…" OK).

## Causa provável
Novo toast de sucesso era criado com `setTimeout(40ms)` após remover o toast `info`, podendo falhar em ficar visível (transição/remoção do elemento anterior).

## Solução
- `upgradeToast()` — reutiliza o mesmo elemento do toast "Reenviando…", troca classe/texto para `success`
- `showToast()` retorna referência do elemento; timers com `WeakMap` para cancelar dismiss ao fazer upgrade
- Sucesso também no resumo da aba (`#admin-subscribers-summary` verde por 9s)
- Fallback: qualquer `response.ok` com `payload.ok` força mensagem de sucesso

## Arquivos
- `index.html` (+ `dist/index.html` via copy)

## Validar
Ctrl+F5 em Assinantes → ícone azul reenviar → toast muda de azul para verde com:
**Mensagem de boas-vindas reenviada no WhatsApp e e-mail**
+ texto verde no resumo acima da tabela.
