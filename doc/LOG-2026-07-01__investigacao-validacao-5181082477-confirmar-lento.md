# Investigação — validação CONFIRMAR lenta (5181082477)

**Data:** 2026-07-01  
**Instância:** `digital-corban-2477` / **5181082477** (+55 18 1082-477)  
**Sintoma reportado:** passo 3 demorou **>3 minutos** (registro anterior: **4m51s**) para detectar CONFIRMAR.

---

## Resumo executivo

A integração **concluiu com sucesso**, mas a detecção de CONFIRMAR foi lenta por uma combinação de fatores típicos desta instância **@lid-heavy** (106 de 115 chats em `@lid`):

1. **`findMessages` global não indexa CONFIRMAR** para este fluxo — probe em produção: **0 ocorrências** em 200 mensagens `fromMe:false`, mesmo após integração OK.
2. **Dependência de webhook + `findChats.lastMessage`** — caminho rápido alternativo; se o webhook falhar ou atrasar, só resta polling.
3. **Instância com histórico grande** (115 conversas) vs instância nova vazia (7943) — indexação Evolution mais lenta.
4. **UI soma tempo percebido:** 20s antes da pergunta Sim/Não + até 120s em «Processando» após Sim.
5. **Deploy em produção** pode não ter tido na hora todos os fixes (`lid-findchats`, `webhook instance objeto`, `strict-timestamp` com fallback webhook).

---

## Perfil da instância (probe 2026-07-01)

| Item | Valor |
|------|--------|
| Nome EVO | `digital-corban-2477` |
| Estado | `open` (live open) |
| Número | `555181082477@s.whatsapp.net` |
| Duplicata EVO | `1311` (connecting) — **não** é a instância usada na validação |
| Webhook | `enabled=true`, URL `https://waba.draxsistemas.com.br/webhooks/evolution`, eventos `["MESSAGES_UPSERT"]` |
| `findChats` | **115** conversas (~**92%** `@lid` no top 50) |
| `findMessages` global | 50–80 records recentes, **26+ @lid**, **0 CONFIRMAR** no histórico consultável |
| Latência API | `findChats` limit 50 ≈ **80–100ms**; `findMessages` ≈ **30–80ms** |

---

## Como o código valida CONFIRMAR

### 1. Início (`startInboundValidation`)

- Configura webhook (`ensureInstanceWebhook`) se necessário.
- Inicia loop backend a cada **280ms** (`INBOUND_VALIDATION_POLL_MS`).
- Frontend faz poll a cada **300ms** com `?nudge=1` (deep) ou `?nudge=2` (agressivo).

### 2. Detecção (`resolveInboundHit`) — ordem

**Fast path (todo tick):**

- `findInboundViaApiFast` — `findMessages` global `fromMe:false`, limit 60.
- `findInboundViaChatsLastMessage` — `findChats` limit **50**, ordenado por `updatedAt`, lê `lastMessage`.

**Deep path (a cada 5 ticks ≈ 1,4s, ou via nudge):**

- `findInboundViaRecentChats` — só **8 JIDs** por ciclo (`INBOUND_FIND_CHATS_LIMIT`), `findMessages` por chat.
- `findInboundViaApiExtended` — variações com limit 100.

**Webhook (ideal <1s):**

- `POST /webhooks/evolution` → `handleInboundValidationWebhook`.
- Aceita `instance` como string **ou objeto** (`normalizeWebhookInstanceRef`).
- Fallback sem timestamp estrito se evento é recente (grace 15s).

### 3. Filtro de timestamp

- Polling normal: `requireTimestamp: true` + `minTimestampMs = validationStartedAt - 15s`.
- Modo agressivo (Sim / nudge=2): grace **60s**.
- Evita falso positivo de CONFIRMAR antigo no histórico.

### 4. UI passo 3 (`index.html`)

| Tempo | Comportamento |
|-------|----------------|
| 0–20s | Spinner «processando» |
| 20s | «Você já enviou CONFIRMAR?» Sim / Ainda não |
| Sim | `POST .../confirmar-envio` — até **4** buscas deep+agressivas |
| Após Sim | «Processando» até detectar; timeout UI **120s** (`REGISTER_INBOUND_AWAIT_CONFIRM_MS`) |
| Poll | `nudge=2` a cada 10 ticks (~3s), `nudge=1` a cada 3 ticks (~0,9s) |

---

## Causa raiz para 5181082477

### A) Cegueira do `findMessages` para CONFIRMAR nesta instância

Durante integração anterior (doc `validacao-confirmar-lid-findchats`):

- `findMessages` global: **CONFIRMAR ausente** (50 records).
- Mensagens chegam com `remoteJid: *@lid` + `remoteJidAlt: *@s.whatsapp.net`.

**Probe atual (pós-integração):** busca em **200** mensagens `fromMe:false` → **0 CONFIRMAR**.

Conclusão: para este número, **não contar com `findMessages` global** para validação; o fast path `findMessages` é inútil na prática.

### B) Caminho real: webhook ou `findChats.lastMessage`

- **Webhook** deveria detectar em <1s se `MESSAGES_UPSERT` chega com `instance` reconhecido.
- **`findChats.lastMessage`** deveria detectar em <1s **depois** que a Evolution atualiza o chat (CONFIRMAR como última mensagem).

Se ambos falham/atrasam → usuário espera minutos.

### C) Histórico grande + @lid

- **115 chats** vs instância nova **7943** (`findChats: []`) onde só webhook funciona.
- Deep scan cobre **8 chats/ciclo** sem ordenação garantida em `extractChatRemoteJids` — pior caso teórico ~18s **se** `findMessages` por chat funcionasse; aqui **não funciona** para CONFIRMAR.

### D) Reconexão recente (ghost open)

Log `qrcode-reconnect-5181082477-ghost-open`: `fetchInstances=open` mas live `connecting` em momento da reconexão. Pode atrasar webhook/indexação até sessão estabilizar.

### E) Tempo de UI ≠ só backend

Cronologia plausível para **4m51s**:

```
0s     — validação inicia, webhook OK configurado
0–20s  — spinner (sem pergunta)
20s    — pergunta Sim/Não
?      — usuário envia CONFIRMAR / clica Sim
20s–3m — polling: findMessages vazio, findChats ainda sem lastMessage=CONFIRMAR, webhook não casou
~3–5m  — findChats.lastMessage ou webhook finalmente detecta → recepção OK
```

---

## Comparação com outros casos

| Instância | Perfil | Tempo típico | Gargalo |
|-----------|--------|--------------|---------|
| **5182007943** | Nova, 0 mensagens | Minutos | Só webhook; bug `instance` objeto |
| **5182001321** | Webhook HTTP 400 (`messages.upsert`) | >2 min | Webhook quebrado + histórico vazio |
| **5181082477** | 115 chats, 92% @lid | **3–5 min** | `findMessages` cego + indexação @lid |

---

## O que já foi corrigido no código (pós-incidente)

1. `findInboundViaChatsLastMessage` no fast path (paralelo a findMessages).
2. `normalizeWebhookInstanceRef` para webhook Evolution v2.
3. Fallback webhook sem timestamp estrito (evento recente).
4. Modal Sim/Não + `confirmUserSentInbound` agressivo.
5. Poll nudge não bloqueante no GET.

**Validar em produção:** `GET /health` → `deployMarker` recente (`validacao-webhook-messages-upsert-fix` ou posterior).

---

## Recomendações

1. **Teste E2E** com `5181082477`: enviar CONFIRMAR **antes** de clicar Sim → medir segundos até recepção OK (meta <5s com webhook + findChats fix).
2. **Log estruturado** em `markInboundReceived`: incluir `via` (`webhook` | `findChats` | `findMessages-deep`) para diagnóstico em produção.
3. **UI:** se `webhookConfigured: false` ou após 30s sem detectar, avisar «instância @lid — confirme que enviou para o número integrado, não só respondeu em chat antigo».
4. **Limpar** instância fantasma `1311` (connecting) no mesmo número para evitar confusão em probes.
5. **Opcional:** em instâncias @lid-heavy, aumentar `INBOUND_FIND_CHATS_LIMIT` ou priorizar chats com `remoteJid` terminando em `@lid` no deep scan.

---

## Comandos de diagnóstico

```bash
node scripts/probe-instance-validacao.cjs 5181082477
# Ajustar script para escolher instância open (digital-corban-2477), não 1311

curl -sS https://waba.draxsistemas.com.br/health | jq .deployMarker
```

---

## Palavras-chave

`5181082477`, `digital-corban-2477`, `CONFIRMAR`, `@lid`, `findChats`, `findMessages`, `validacao-inbound`, `webhook`, `4m51s`, `ghost-open`
