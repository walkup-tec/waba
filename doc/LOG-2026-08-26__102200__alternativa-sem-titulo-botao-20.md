# LOG — Alternativa: botão nativo sempre (rótulo da IA só é a legenda)

## Contexto

A IA varia o texto do botão. Em alguns envios o WhatsApp chegou **sem botão**. Pedido: mesmo com rótulo gerado pela IA, o botão deve sair no mesmo formato nativo.

## Causa raiz

Após `sendButtons` falhar (rótulo inválido/emoji/`viewOnce` tratado como fantasma), o motor fazia fallback `sendText` **sem botão**. O rótulo da IA não pode mudar o tipo da mensagem.

## Solução

- Rótulo da IA é só `displayText` (sanitizado, máx. 20). Payload continua `sendButtons` URL.
- Se o rótulo da IA falhar, tenta de novo com `Quero saber mais`. Sem fallback texto.
- `viewOnce` + `cta_url`/`interactiveMessage` não é mais tratado como botão fantasma.
- Sem URL do botão: lead volta a pending (não envia texto).
- Marker `DEPLOY-2026-08-26-alternativa-botao-nativo-sempre`.

## Arquivos

- `src/index.ts`, `src/deploy-marker.ts`, `dist/index.js`, `dist/deploy-marker.js`

## Como validar

Após commit `master` + Redeploy: próximo envio Alternativa com rótulo da IA deve ter o mesmo botão URL nativo. Sem `sendText` extra.

## Palavras-chave

sendButtons, buttonLabel, IA, fallback texto, viewOnce, API Alternativa
