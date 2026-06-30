# LOG — Validação inbound: exibir número integrado no passo 3

**Data:** 2026-06-30  
**Marker:** `DEPLOY-2026-06-30-validacao-inbound-numero-display`

## Contexto

Na etapa 3 do wizard (*Conectar instância WhatsApp*), a frase *"No outro WhatsApp, abra o chat com"* mostrava `—` em vez do número conectado (ex.: `555182006019` / `atendimento-6019`).

Causa: após o QR, a Evolution nem sempre expõe `ownerJid`/`number` imediatamente; o backend exigia número na instância `open` e o frontend só preenchia `#register-inbound-number` se o campo opcional do passo 1 tivesse valor.

## Solução

### Backend (`src/instance-inbound-validation.service.ts`)

- `extractInstanceNumber`: mais campos (`wid`, `profile.number`, etc.) + `normalizeWhatsAppNumber`.
- `fetchConnectedInstance`: retorna instância `open` mesmo sem número (antes retornava `null`).
- `resolveValidationInstanceNumber`: ordem Evo → hint do POST → sufixo numérico do nome da instância (≥12 dígitos).
- `startInboundValidation`: grava `instanceNumber` resolvido; atualiza validação ativa se número estava vazio.

### Frontend (`index.html`)

- `formatRegisterInboundPhone`, `resolveRegisterInboundDisplayNumber`, `setRegisterInboundNumberDisplay`.
- Fallback: `status.instanceNumber` → input do formulário → `instancesData.items` (refresh antes do POST).
- `applyRegisterInboundStatus` usa resolução unificada em todo o poll.

## Arquivos alterados

- `src/instance-inbound-validation.service.ts`
- `index.html` (+ `dist/index.html` via build)
- `src/deploy-marker.ts`

## Como validar

1. Redeploy Easypanel (ou `npm run build` + push `master`).
2. `GET /health` → `deployMarker` = `DEPLOY-2026-06-30-validacao-inbound-numero-display`.
3. Conectar instância (ex. `atendimento-6019`) sem preencher número no passo 1.
4. Passo 3 deve mostrar `+55 51 82006-019` (ou equivalente), não `—`.
5. Enviar **CONFIRMAR** do outro celular; validação deve avançar.

## Palavras-chave

`validacao-inbound`, `register-inbound-number`, `instanceNumberHint`, `ownerJid`, wizard passo 3, CONFIRMAR
