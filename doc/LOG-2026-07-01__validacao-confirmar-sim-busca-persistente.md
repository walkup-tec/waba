# LOG — Validação CONFIRMAR: Sim com busca persistente

**Data:** 2026-07-01  
**Marker:** `DEPLOY-2026-07-01-validacao-confirmar-sim-busca-persistente`

## Problema

- 1º clique em «Sim, já enviei» sem feedback (retorno silencioso se `validationId` vazio ou request em andamento).
- Após 2º clique: «Processando» e volta ao prompt — uma única consulta à Evolution não encontrava CONFIRMAR e resetava o fluxo.

## Solução

### Frontend (`index.html`)

- `registerInboundUserAwaitingConfirm`: após Sim, permanece em `verify-receive` até detectar CONFIRMAR ou 2 min.
- Feedback imediato: botão «Buscando na Evolution…», linha Recepção visível, toast se clicar de novo durante busca.
- Sem `validationId`: toast + tenta reiniciar validação.
- Poll com `nudge=2` contínuo enquanto aguarda; re-scan `confirmar-envio` a cada ~3,6s.
- Não volta ao prompt após primeira falha de detecção.

### Backend (`instance-inbound-validation.service.ts`)

- `confirmUserSentInbound`: até 4 tentativas aggressive/deep com 700ms entre elas.

## Validação

```powershell
npm run build
node scripts/verify-validacao-modal-phases.cjs
```

Teste manual: passo 3 → Sim → deve mostrar Recepção/Processando imediatamente e avançar quando CONFIRMAR existir na EVO.
