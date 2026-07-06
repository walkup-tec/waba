# LOG — Validação inbound híbrida (revert 19/06 + dedupe 22/06)

**Data:** 2026-06-21  
**Pedido:** Opções 2 e 3 — restaurar lógica de validação de 19/06 com dedupe de 22/06, mantendo UI/número do passo 3.

## Solução

### Backend
- `src/instance-inbound-validation.service.ts` restaurado do commit **`a41ba4b`** (22/06/2026)
  - Poll interno ~3s, `findMessages` + webhook
  - Dedupe de resposta por conversa (fix 22/06)
  - Sem `findChats`, `refreshInboundValidation`, `forceRestart`
- `src/index.ts`: GET `/validacao-inbound/:id` síncrono (sem `?nudge`); POST sem `forceRestart`

### Frontend (híbrido)
- Mantidos: layout passo 3, link wa.me, `status-conexao`, lista instâncias, `setRegisterInboundNumberDisplay`
- Revertido: poll **2,5s** sem `nudge`; POST simples `{ number }`
- Botões «Já enviei CONFIRMAR» / «Tentar novamente» permanecem; fazem GET simples ou reinício sem `forceRestart`

### Marker
- `DEPLOY-2026-06-21-validacao-inbound-hybrid-a41ba4b`

## Arquivos alterados
- `src/instance-inbound-validation.service.ts`
- `src/index.ts`
- `index.html`
- `src/deploy-marker.ts`
- `dist/` (build)

## Validar
1. `npm run build` — OK
2. Conectar instância → passo 3 exibe número formatado
3. Enviar CONFIRMAR de outro WhatsApp → recebe resposta automática e avança para passo 4
4. GET `/health` → marker `DEPLOY-2026-06-21-validacao-inbound-hybrid-a41ba4b`

## Palavras-chave
`validacao-inbound`, `a41ba4b`, `CONFIRMAR`, `hybrid revert`, `poll 2500`
