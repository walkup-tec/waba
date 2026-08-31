# LOG — Aquecedor volume ~10× abaixo do esperado (pós 24/07 16:51)

## Contexto

Usuário: só 3 envios confirmados desde 24/07/2026 16:51; deveria ser ~10×. Pedido de investigação profunda.

## Evidências (2026-07-25 ~09:30–09:45 SP)

### Envios confirmados (`logs_envios_br`)

| Quando | Origem → Destino |
|--------|------------------|
| 24/07 16:51:12 | walkup → 8927 |
| 24/07 16:51:49 | soma → 8927 |
| 24/07 16:55:09 | 8927 → soma |

- Desde **sáb 06:00** (expediente aberto): **0**
- Sex **16:55→20:00** (ainda expediente): **0** após os 3

### Ritmo esperado (código)

`AQUECEDOR_DEFAULTS`: 1 send/ciclo, wait 300–900s, expediente sex 06–20, janela 60/pausa 14.

| Trecho | Esperado se saudável | Real |
|--------|----------------------|------|
| Sex 16:55–20:00 (~3,1 h) | ~12–37 | **0** |
| Sáb 06:00–09:30 (~3,5 h) | ~14–42 | **0** |
| Período total aberto útil | ~21–63 | **3** |

Conclusão: não é “só o intervalo 5–15 min”. O motor **parou de gerar ENVIADO** com a janela aberta.

### Produção

- `/health`: `DEPLOY-2026-07-24-aquecedor-outbound-ack-error`, `aquecedorProcessing: true`
- Sem SSH local (`VPS_SSH_PRIVATE_KEY` só no GitHub) → não leu `/app/data/aquecedor-desired-owners.json` nem `lastResult` do container

### Pool EVO agora (só leitura, sem sendText)

**Open + outbound healthy (5):** `soma`, `walkup`, `1321-01`, `soma-crm`, `digital-corban-2477`  
**Open + outbound broken 100% ERROR (5):** `1321`, `1261`, `6011`, `6635`, `soma-promotora`  
**Close (13):** incl. **`8927`** (participou dos 3 últimos sucessos)

## Causas (ranqueadas)

1. **Colapso do pool + falhas reais de entrega** (primário no volume)
   - Instâncias “open” com `MessageUpdate=ERROR` não entregam (evidência 24/07).
   - Deploy `outbound-ack-error` exclui broken e não conta HTTP 201 como sucesso → volume honesto cai.

2. **Silêncio total após 16:55 com expediente aberto** (primário no “parou”)
   - Com 5 healthy open hoje, ainda assim 0 envios no sábado de manhã.
   - Hipóteses (precisam confirmação no painel/VPS): motor `desired=false` pós-redeploy; `<2` active por lifecycle `restricted_wait`/`preparing`; ciclos só deferindo (cooldown/turno/fila); `8927` close quebrou a malha usada na sexta.

3. **Expediente noturno** (secundário)
   - Sex 20:00–sáb 06:00: zero por desenho — não explica o buraco 16:55–20:00 nem a manhã de sábado.

## O que NÃO é

- Falso negativo único do `findMessages` no walkup (teste 24/07: ACK=`ERROR` na origem).
- Cap diário 70 (irrelevante com 3 envios).

## Próximos passos operacionais

1. No painel: Aquecedor **ligado**? Texto de `lastResult` / status.
2. Reconectar QR: `1321`, `1261`, `6011`, `6635`, `8927` (+ `soma-promotora` se for usar).
3. Se “ligado” e janela aberta sem envio: no VPS ler `data/aquecedor-desired-owners.json`, lifecycle, logs `[Aquecedor]`.
4. Opcional código: endpoint diagnóstico autenticado com `connectedActive`, `brokenOutbound[]`, `desired`, `lastResult` (sem sendText).

## Palavras-chave

aquecedor volume, 10x, MessageUpdate ERROR, outbound broken, 8927 close, expediente, desired owners, DEPLOY-2026-07-24-aquecedor-outbound-ack-error
