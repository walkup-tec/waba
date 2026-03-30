# Log: botão «Gerar QRCode» sem ação / sem log no Console

## Contexto

No modal **Registrar / Atualizar instância**, o botão **Gerar QRCode** não disparava comportamento visível e o Console ficava vazio.

## Causas prováveis

1. **Stacking (z-index)**: overlay de registro usava `z-index: 1200`, igual a outros `confirm-overlay`; modais/work overlays mais altos (ex. 1300, 2200) podiam ficar **por cima** e interceptar o clique sem feedback.
2. **Listener direto no botão**: em cenários de timing/DOM, o `addEventListener` no `#register-qrcode-btn` pode falhar em ancorar; **delegação** no `#register-instance-overlay` é mais estável.
3. **Retorno silencioso**: `registerAndGenerateQrCode` retornava sem `showToast`/`console` quando algum `getElementById` falhava.

## Solução

1. CSS: `#register-instance-overlay.confirm-overlay { z-index: 2600; }` (acima de work 1300, toasts 1500, modais campanha 2200).
2. Um único `click` no `#register-instance-overlay` trata:
   - `#register-qrcode-btn` → `registerAndGenerateQrCode()` + `console.info` diagnosticável.
   - `#register-refresh-qrcode-btn` → `refreshQrCodeInRegisterModal()` idem.
   - clique no backdrop → `closeRegisterModal()`.
3. Removidos listeners duplicados só no botão.
4. Mensagens de erro quando o modal está incompleto no DOM (`refreshQrCodeInRegisterModal` e `registerAndGenerateQrCode`).

## Arquivos

- `index.html` (e `dist/index.html` via `node scripts/copy-index-html.mjs`)

## Como validar

1. `npm run dev` ou `npm run dev:isolado`, abrir Instâncias → Nova instância ou QRCode.
2. Abrir o modal, clicar **Gerar QRCode**; no Console deve aparecer `[Waba] Gerar QRCode: clique (delegado).` e o fluxo (toast/loading/requisição) seguir.
3. Com **Ctrl+F5** garantir HTML atualizado.

## Palavras-chave

`register-instance-overlay`, `register-qrcode-btn`, z-index 2600, delegação de evento, QRCode
