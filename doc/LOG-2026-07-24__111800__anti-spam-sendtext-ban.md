# LOG — Anti-spam sendText (bloqueio WhatsApp 8918/6635)

**Data:** 2026-07-24 ~11:05–11:11  
**Marker:** `DEPLOY-2026-07-24-aquecedor-anti-spam-sendtext`

## Incidente

Após diagnóstico manual, o WhatsApp aplicou **block**. Em ~5–6 min houve:

| # | Envio | HTTP |
|---|--------|------|
| 1 | 6635→8918 teste | 201 |
| 2–4 | 6635→8918 variantes (1×400 + 2×201) | misto |
| 5 | 8918→6635 reverso | 201 |
| 6 | 1261→8918 | 201 |

**5 mensagens aceitas + 1 falha** em rajada = padrão de spam.

## Causa no aquecedor (mesmo risco)

Loop reenviava por **variante de número** quando a entrega não confirmava no destino (`tentando variante…`), gerando vários `sendText` no mesmo ciclo.

## Correção

1. Máx. **1 sendText aceito** por ciclo do aquecedor.
2. Variantes só após falha de envio (`exists:false`), no máx. **2** tentativas falhas.
3. Mensagem só na origem → cooldown **15 min** + marca restrição; **sem** reenvio.
4. Rule alwaysApply: `.cursor/rules/anti-spam-whatsapp-sendtext.mdc` (proíbe rajadas em probe/agente).

## Validar

1. Redeploy; marker no `/health`.
2. `rg "tentando variante" dist/index.js` → **zero** hits.
3. Não disparar probes `sendText` em série.

## Keywords

anti-spam, ban, block, sendText, variante, 8918, 6635, aquecedor
