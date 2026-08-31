# LOG — Fix tela Push vazia (Suporte)

## Contexto

Após deploy do menu Push, a aba abria no sidebar mas o conteúdo principal ficava em branco em produção.

## Causa raiz

O handler de troca de abas (`switchTab`) atualizava `tab-admin-chamados` e `tab-admin-monitor-cpu`, mas **não** incluía `tab-admin-push`. O painel permanecia com classe `tab-hidden` (`display: none !important`).

## Correção

1. `const adminPushPanel = document.getElementById("tab-admin-push")`
2. Toggle `tab-hidden` / `aria-hidden` quando `nextTab === "admin-push"`
3. `isTabBlockedByMenuPolicy`: `admin-push` restrito a master
4. CSS `suporte-section-active` espelhando layout de `admin-section-active` para painéis Suporte

## Arquivos

- `index.html` (e `dist/index.html` via build)

## Validar

Master → Suporte → Push: formulário (título, mensagens, destinos, histórico) visível.

## Palavras-chave

`admin-push`, `tab-hidden`, `suporte-section-active`, `switchTab`
