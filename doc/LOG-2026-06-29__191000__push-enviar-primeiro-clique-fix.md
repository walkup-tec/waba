# LOG: Push — botão Enviar push no primeiro clique

## Contexto

Master em **Suporte → Push** clicava em **Enviar push** após preencher mensagem/título e **nada acontecia** no primeiro clique (parecia botão morto).

## Diagnóstico

Mesmo padrão já corrigido em **Salvar configurações** do Disparador (`doc/LOG-2026-06-26__disparos-salvar-config-primeiro-clique.md`):

1. **Blur vs click:** com foco em `#admin-push-original` ou `#admin-push-reviewed`, o primeiro clique no botão dispara `blur` no textarea e o navegador **cancela o `click`** no botão.
2. Listeners de Push estavam acoplados a `initAdminChamadosUi()` em vez de módulo dedicado.
3. Feedback só via toast no canto — fácil de não perceber em validações.

## Solução

1. **`initAdminPushUi()`** — módulo dedicado; chamado no boot e ao abrir aba Push.
2. **`pointerdown` + `preventDefault`** em **Enviar push** e **Revisar com IA** (paridade com `#dis-save-btn`).
3. **`#admin-push-send-feedback`** — mensagem inline abaixo do botão (info/success/warning/error).
4. **`sendAdminPush()`** — feedback inline em todas as validações e durante envio; remove `required` do título (validação continua no JS quando Comunidade marcada).

## Arquivos alterados

- `index.html`, `dist/index.html` (via `npm run build`)

## Como validar

1. Login master → Suporte → Push.
2. Preencher título + mensagem; deixar **Assinantes** marcado.
3. Com cursor ainda no textarea, clicar **Enviar push** **uma vez**.
4. Deve mostrar **Enviando push…** / toast / sucesso ou erro inline imediatamente.

## Palavras-chave

`admin-push-send-btn`, `blur`, `pointerdown`, `initAdminPushUi`, `Enviar push`, primeiro clique, push
