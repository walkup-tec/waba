# LOG — Validação 1261: anti-histórico EVO + anti-flicker etapa 2

**Data:** 2026-07-22 15:41  
**Marker:** `DEPLOY-2026-07-22-validacao-anti-historico-evo`

## Evidência EVO (instância 1261)

`POST /chat/findMessages/1261` retornou **11×** `Confirmar` inbound + **2×** `Validação WABA concluída. WABA-VAL:…` outbound (histórico de tentativas).

Causas da falsa confirmação:
1. Grace de 15–60s reaproveitava `CONFIRMAR` recente ao clicar “Tentar novamente”.
2. `findReplyInChat` aceitava **qualquer** texto “Validação WABA concluída” → modal “ok” **sem** enviar o marker da validação atual.
3. Stepper: `setRegisterWizardStep(2)` competia com passo 3 → check da etapa 2 piscava.

## Correção

1. **Marca d’água** `keywordHighWaterMarkMs` no start (maior timestamp de CONFIRMAR já na EVO).
2. Aceitar só mensagem com `ts > watermark` e `ts >= start - 2s` (skew).
3. Prova de envio **somente** com `WABA-VAL:<id>` desta sessão (nunca texto genérico).
4. Stepper: não regredir 3→2; check ✓ estável via CSS em `.done`.

## Teste offline (PASS)

```bash
node scripts/test-inbound-validation-anti-history.cjs .tmp-evo/find-all-out.json
```

Resultado no dump real 1261: `falseReceiveWouldPass=0`, `oldReplyWouldPassStrictMarker=0`, `ok=true`.

## Validação em produção

1. Push + Redeploy `waba_disparador` (FTP sozinho não basta).
2. `/health` → marker `DEPLOY-2026-07-22-validacao-anti-historico-evo`.
3. Abrir validação 1261 **sem** enviar CONFIRMAR → deve ficar aguardando (não finalizar).
4. Enviar CONFIRMAR novo → deve receber reply com **novo** `WABA-VAL:…` no WhatsApp.
5. Etapa 2 do stepper permanece com ✓ estável.

## Arquivos

- `src/instance-inbound-validation.service.ts` / dist
- `index.html` / `dist/index.html`
- `src/deploy-marker.ts`
- `scripts/test-inbound-validation-anti-history.cjs`

## Palavras-chave

1261, CONFIRMAR histórico, watermark, WABA-VAL, falso positivo, flicker stepper, findReplyInChat
