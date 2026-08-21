# Fix — modal validação: loop do card verde + reply CONFIRMAR

## Contexto

Na etapa 3 do modal «Conectar instância WhatsApp»:

1. O card verde «WhatsApp conectado no sistema WABA…» (check do QR) sumia e voltava em loop, atrapalhando o card azul «Recepção da mensagem».
2. Após enviar `CONFIRMAR`, o modal avançou, mas a mensagem `Validação WABA concluída…` não apareceu no chat (relato: não chegou ao fluxo do `5182001300`).

## Causas

### Loop do card verde (UI)

- Poll a cada **300ms** chamava `applyRegisterInboundStatus` → `setRegisterInboundPhase` → `scrollIntoView({ behavior: "smooth" })` a cada tick.
- A cada poll: animação `reg-val-check-enter` e restart das mensagens de progresso.
- Em **404** da sessão (validação in-memory perdida), a UI **reiniciava** a validação sozinha → `reset` esconde o banner → `evoAlreadyOpen` mostra de novo → loop.

### Reply sem mensagem no chat (backend)

- GET do poll só lia status (não disparava `refresh` / envio).
- 1ª tentativa já expandia variantes BR; HTTP OK em JID errado + prova falha deixava `sendAttempted=true` **sem retry**.
- Risco de enviar para o próprio número integrado.

Nota: a resposta sai **do** número integrado (`5182001300`) **para** o outro WhatsApp que enviou `CONFIRMAR` — não é enviada “para” o 1300 como destino.

## Solução

### UI (`index.html` / `dist/index.html`)

- Poll **2000ms**.
- Scroll só quando a **fase muda**.
- Animação / progress messages só na **primeira** exibição do card de recepção.
- Ao entrar em `verify-receive`, esconde o banner verde (foco na recepção).
- 404: **não** auto-reinicia; mostra retry manual.

### Backend

- GET `/instancias/validacao-inbound/:id` → `refreshInboundValidation` (busca + follow-up de envio).
- 1ª tentativa de send: só chat do CONFIRMAR; retry com variantes BR.
- Nunca enviar para o próprio `instanceNumber`.
- `sendRetryCount` libera 2ª tentativa se HTTP OK sem prova no chat.
- Marker: `DEPLOY-2026-07-24-validacao-ui-loop-reply-retry`

## Arquivos

- `index.html`, `dist/index.html`
- `src/instance-inbound-validation.service.ts` (+ dist)
- `src/index.ts` (+ dist)
- `src/deploy-marker.ts` (+ dist)

## Como validar

1. Push `master` + Redeploy Easypanel `waba_disparador` + confirmar marker em `/health`.
2. Nova integração → passo 3: card verde **não** pisca; recepção estável.
3. Enviar `CONFIRMAR` de **outro** WhatsApp → aparece `Validação WABA concluída. WABA-VAL:…` **nesse** chat.

## Palavras-chave

validacao-inbound, CONFIRMAR, flicker, scrollIntoView, sendRetryCount, 404 restart, deploy marker
