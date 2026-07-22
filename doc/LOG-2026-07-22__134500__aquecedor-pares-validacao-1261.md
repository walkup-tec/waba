# LOG — Aquecedor troca de pares + validação 1261

## 1) Aquecedor — 6011 só recebia

**Causa:** após A→B, a resposta B→A recebia bônus irrisório (−500) enquanto o par recém-usado ganhava penalidade **+1e18**. O sistema preferia C→B (B continua recebendo) em vez de B→A.

**Fix:**
- Pool prioritário: se existe `owesPairReply`, só esses pares competem
- Score: resposta pendente −2e18; penalidade do último par **não** aplica se for a resposta do turno
- Equidade: quem recebe muito / envia pouco vira origem preferencial

## 2) Integração 1261 — modal ok sem mensagem + Preparando pisca

**Causa reply:** sendText com `@lid` / “sucesso falso” em falha técnica → UI finalizava sem mensagem real.
**Fix:** preferir telefone (`remoteJidAlt` / dígitos); não marcar `sendTest.success=true` sem HTTP OK ou prova no chat.

**Causa Preparando:** `forceNewIntegration` usava `createdAt` EVO antigo (nome curto `1261` reutilizado) → promovia/sumia na hora.
**Fix:** force sempre `preparingSince = now`; limpa chaves alias duplicadas no lifecycle.

## Arquivos
- `src/index.ts` / `dist/index.js`
- `src/instance-inbound-validation.service.ts` / dist
- `src/services/aquecedor-instance-lifecycle.service.ts` / dist

## Palavras-chave
aquecedor, owesPairReply, 6011, 1261, @lid, preparando, forceNewIntegration
