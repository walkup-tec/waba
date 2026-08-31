# LOG — Chip em restrição fica apto à troca 1:1 na campanha

## Contexto do pedido

Na campanha, números com evidência de banimento/restrição WhatsApp (EVO ainda `open`) ficavam verdes e travados, sem enviar e sem ser substituídos. A regra de produto: nesses status o chip entra na troca 1:1 pelo próximo spare conectado.

## Comandos / ações

- Ajuste em `campaignChipConnectedForDispatch` (`restricted`).
- Tag explícita deixa de ser apagada só porque a Evolution está `open`.
- Persistência da tag ao detectar 403 / send 403 / outbound ERROR / ACK ERROR / probe de restrição.
- Tick da campanha deixa de desfazer pausa/restrição desses chips.
- Chip em `restricted_wait` também conta como inapto (não envia → troca).

## Solução implementada

1. **Vermelho + troca** se qualquer um destes for verdadeiro, mesmo com EVO `open`:
   - `statusReason` 403
   - HTTP 403 em `sendText` / `sendMedia`
   - outbound `MessageUpdate=ERROR` (probe ou ACK da campanha)
   - tag **Restrição** persistida
   - fase aquecedor `restricted_wait`
2. **Persistência:** `markWhatsappRestrictionExplicit` grava o store (3h). O mapa em memória sozinho se perdia no Redeploy.
3. **Não limpar** restrição explícita quando `live=open` (banimento costuma manter a sessão aberta). Expira só por TTL.
4. **`releaseHumanPauseForSelectedCampaignInstances`** não reativa disparo nem apaga pausa de chip bloqueado/restrito.

## Arquivos criados/alterados

- `src/instances/evo-connection-state.service.ts`
- `src/instances/whatsapp-connecting-restriction.service.ts`
- `src/index.ts`
- `src/deploy-marker.ts`
- `.cursor/project-memory/02-BUSINESS_RULES.md`
- `.cursor/project-memory/05-DECISIONS.md`
- `.cursor/project-memory/06-CURRENT_STATUS.md`

## Como validar

1. Selfcheck: `npx ts-node --transpile-only src/instances/evo-connection-state.selfcheck.ts`
2. Após commit/push + Redeploy EasyPanel `waba_disparador`: `GET /health` deve ser `DEPLOY-2026-08-29-112500-restricao-apto-troca`
3. Na campanha: chip com 403 / Restrição / ACK ERROR fica vermelho e é substituído 1:1 se houver spare
4. Instâncias: tag Restrição não some só porque o connectionState é `open`

## Observações de segurança

- Sem `sendText` de diagnóstico. Sem exposição de chaves.

## Palavras-chave

restricao, 403, statusReason, outbound ERROR, troca automatica, campanha, chip vermelho, restricted_wait, 9224, 2102
