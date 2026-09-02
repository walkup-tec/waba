# LOG — Push GitHub master (modal excluir template)

## Contexto

Pedido: push de tudo o que falta para o usuário fazer o deploy no EasyPanel.

## O que foi para `walkup-tec/waba` `master`

Fast-forward `c38df14` → `81e149a`.

- Modal de exclusão de template (confirmação + spinner até a Graph).
- `dist/index.html` e `dist/deploy-marker.js` no mesmo commit.
- Marker: `DEPLOY-2026-09-02-103000-modal-excluir-template`.

Nada pendente no working tree além de `C:\\Users\\Usuario\\npm-cache/` (não sobe).

## Como validar (depois do Redeploy que o usuário fizer)

```bash
curl -sS https://waba.draxsistemas.com.br/health
```

O `deployMarker` deve ser `DEPLOY-2026-09-02-103000-modal-excluir-template`.

No painel: Excluir abre o modal do sistema, não o `confirm` do navegador.

## Observações

Push Cursor `origin` ≠ produção. Redeploy do `waba_disparador` fica com o usuário. Login pode 502 ~1 min até o heal v6.

## Palavras-chave

github, master, push, EasyPanel, modal, excluir, template
