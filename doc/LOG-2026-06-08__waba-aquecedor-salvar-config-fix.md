# LOG — Aquecedor Salvar configurações sem efeito

**Data:** 2026-06-08  
**Deploy marker:** `DEPLOY-2026-06-08-waba-aquecedor-salvar-config-fix`

## Causa

1. **Dois cliques:** primeiro clique só habilitava edição (`aquecedorEditMode`) e retornava sem salvar.
2. **Refresh 15s** na aba Aquecedor chamava `loadAquecedorConfig()` e podia sobrescrever o formulário.

## Correção (`index.html`)

- Com botão **Salvar configurações**, um clique grava de fato.
- Botão **Editar configurações** continua só expandindo o painel (com toast).
- Aba Aquecedor pausa auto-refresh global (como Admin Usuários/Financeiro).
- Feedback «Salvando configuração…» no header; `credentials: same-origin` no POST.

## Pendência

- Commit/deploy produção quando usuário solicitar.
