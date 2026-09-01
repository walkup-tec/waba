# Deploy em produção sem o modal de alerta

## Contexto

Conferir se o último deploy levou a estilização do alerta (modal do sistema no envio à Meta).

## Evidências

- Produção `GET /health` → `deployMarker` = `DEPLOY-2026-09-01-181200-header-editavel-arquivo`
- HTML de `https://waba.draxsistemas.com.br/`: sem `#meta-tpl-ai-overlay`; ainda tem `window.confirm` e «Cadastrar os três templates no portfólio selecionado»
- `github.com/walkup-tec/waba` `master` estava em `e433ba1` (cabeçalho editável / arquivo)
- O modal entrou em `b5f287c` e os commits seguintes (`31dd92d`, `e0239f2`, `1f41df7`) só no remoto Cursor

## Causa

EasyPanel / Deploy FTP olham o GitHub `master`. Os commits do modal não tinham sido empurrados para esse `master`.

## Ação

Push de `HEAD` (`1f41df7` + docs desta auditoria) para `walkup-tec/waba` `master`. O site só muda após Redeploy do `waba_disparador`. Marker esperado: `DEPLOY-2026-09-01-201200-cabecalho-fixo-utilidade`.

## Palavras-chave

deploy, github master, modal, confirm, e433ba1
