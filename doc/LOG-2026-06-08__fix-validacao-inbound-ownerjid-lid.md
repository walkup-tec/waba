# LOG — Fix validação inbound travada no passo 3

**Data:** 2026-06-08  
**Sintoma:** Usuário enviou CONFIRMAR mas modal ficou em "Aguardando…"; número exibido como "—".

## Causa raiz

1. **Evolution v2** retorna `ownerJid` (ex.: `555197979224@s.whatsapp.net`), não `owner`/`number`.
2. `extractInstanceNumber` ignorava `ownerJid` → `fetchConnectedInstance` retornava `null` → validação **não iniciava** (UI ficava no passo 3 sem polling real).
3. Mensagem `CONFIRMAR` chegou com `remoteJid` em formato **`@lid`**; `sendText` com só dígitos falhava (`exists: false`). Com JID completo `85890839908396@lid` funciona.

## Correções

- `ownerJid` em `extractInstanceNumber` (inbound, probe, index)
- `resolveSendTarget()` usa `referenceJid` completo quando há `@`
- `startInboundValidation` aceita `instanceNumberHint` (número do formulário)
- UI envia `number` no POST; exibe número do form; toast em erro de início

**Marker:** `DEPLOY-2026-06-08-validacao-inbound-ownerjid-v1`

## Reteste

1. Reiniciar `npm run dev:v02`
2. Ctrl+F5 na aba Instâncias
3. Nova instância → QR → passo 3 deve mostrar número (5197979224)
4. Do celular de referência, chat **direto** com o número da instância, enviar **CONFIRMAR**
5. Deve avançar: recepção OK → resposta automática → passo Pronto
