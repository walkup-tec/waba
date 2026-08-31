# LOG — Validação inbound: detecção agressiva + fallback EVO open

**Data:** 2026-06-30  
**Pedido:** Aba de validação rodando muito tempo e exibindo erro de recebimento da validação (timeout CONFIRMAR).

## Contexto

Usuário deixou o passo 3 do wizard em polling; após longa espera, backend expirou com `receiveTest.success === false` (“Tempo esgotado sem receber CONFIRMAR…”). Instância já estava **open** na Evolution, mas a UI travava no erro em vez de liberar o cadastro.

## Causa raiz

1. **Backend:** `runValidationLoop` chamava `resolveInboundHit(..., aggressive=false)` — `findChats` só no nudge GET; mensagens CONFIRMAR podiam não ser detectadas durante o loop interno.
2. **Backend:** `finalizeExpired` marcava falha imediata sem última varredura agressiva antes de expirar.
3. **Frontend:** `handleRegisterInboundTerminalStatus` em status `finished` com recepção falha mostrava erro/retry mesmo com EVO `open`, conflitando com o fallback de conexão.

## Solução

### Backend (`instance-inbound-validation.service.ts`)

- Loop de validação usa `aggressive=true` em `resolveInboundHit` (findChats + findMessages).
- `finalizeExpiredAsync`: antes de marcar timeout, última busca agressiva; se achar CONFIRMAR, executa follow-up e só expira se ainda incompleto.
- `textMatchesKeyword`: tolerância de mensagem até `needle.length + 12` caracteres.

### Frontend (`index.html`)

- `handleRegisterInboundTerminalStatus`: se `finished` com recepção falha, consulta EVO; se `open`, chama `finishRegisterWizardConnectionOnly` (passo 4) em vez de travar no erro.
- Fallback de conexão reduzido de 45s → **30s** (`REGISTER_INBOUND_CONNECTION_ADVANCE_MS`).

### Deploy marker

`DEPLOY-2026-06-30-validacao-inbound-detect-fallback`

## Arquivos alterados

- `src/instance-inbound-validation.service.ts`
- `index.html`
- `src/deploy-marker.ts`

## Como validar

1. Deploy em produção (marker visível no passo 3 ou `/api/health`).
2. Conectar número no wizard passo 3.
3. **Cenário A:** enviar CONFIRMAR de outro WhatsApp → sucesso completo (recepção + resposta).
4. **Cenário B:** não enviar CONFIRMAR → em ~30s ou ao expirar backend, avançar passo 4 com mensagem “instância liberada”, sem tela de erro permanente.
5. **Cenário C:** EVO desconectada + timeout → mantém retry/skip.

## Segurança

Sem alteração de credenciais ou RLS; apenas polling Evolution e UX do wizard.

## Palavras-chave

validacao-inbound, CONFIRMAR, finalizeExpired, aggressive findChats, wizard passo 3, connection fallback, timeout recepção
