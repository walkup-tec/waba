# LOG — Validação CONFIRMAR sem «Sim, já enviei» (detecção só no backend)

**Data:** 2026-07-02

## Contexto

Após correção do Redis Evolution, a validação CONFIRMAR passou a funcionar. O usuário pediu remover a etapa em que o operador clica **«Sim, já enviei»** — a identificação da mensagem deve ocorrer apenas pelo backend (webhook + worker 2s).

## Alterações

### Frontend (`index.html`)

- Removido bloco HTML do prompt Sim/Não e botão **«Já enviei CONFIRMAR»**.
- Ao iniciar validação (`POST validacao-inbound`), UI entra direto em `verify-receive` com mensagens de progresso.
- Poll GET status continua (300ms); sem `POST confirmar-envio`.
- Instruções do passo 3: «O sistema detecta a mensagem automaticamente — não é preciso confirmar aqui».
- Marker: `DEPLOY-2026-07-02-validacao-confirmar-backend-only`.

### Backend (`instance-inbound-validation.service.ts`)

- Texto `receiveWaitDetail` sem «confirme abaixo quando enviar».
- Endpoint `POST .../confirmar-envio` mantido (compatibilidade), mas não é mais chamado pela UI.

### Script

- `scripts/verify-validacao-modal-phases.cjs` atualizado para o novo fluxo.

## Como validar

1. Integrar número novo → passo 3 mostra instruções + linha «Recepção da mensagem» em processamento.
2. Enviar CONFIRMAR de outro WhatsApp **sem clicar em nenhum botão de confirmação**.
3. Em poucos segundos: recepção OK → resposta automática → passo 4.
4. `node scripts/verify-validacao-modal-phases.cjs` → OK.

## Palavras-chave

`validacao-inbound`, `CONFIRMAR`, `backend-only`, `sem-sim`, `webhook`, `worker`, `verify-receive`
