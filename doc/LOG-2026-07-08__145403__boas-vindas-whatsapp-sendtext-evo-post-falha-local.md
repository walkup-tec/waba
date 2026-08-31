# LOG — Boas-vindas WhatsApp: código OK, POST Evolution falha no V02 local

**Data:** 2026-07-08  
**Contexto:** Números `(51) 98200-7943` (`51982007943`) e `(51) 98200-6019` (`51982006019`) ativos no WhatsApp; reenvio de boas-vindas não entrega mensagem.

## Diagnóstico

### O código chama o envio

Logs do servidor V02 (`terminals/418896.txt`):

```
[mail] boas-vindas mozart.hotmart@gmail.com enviado para ...
[whatsapp] boas-vindas tentativa falhou (walkup) para 51982007943: socket hang up
[whatsapp] boas-vindas tentativa falhou (walkup) para 51982006019 (draxsistemas@gmail.com): socket hang up
```

E-mail **enviado**; WhatsApp **tentado** e falha na API Evolution.

### Instâncias Evolution estão `open`

Com `.env.v02` carregado:

- `drax-oficial` → `connectionState=open`, número `555181077770`
- `walkup` → `connectionState=open`, número `555197462102`

### Falha real: `POST /message/sendText` a partir do PC local

Probe (`scripts/probe-evo-sendtext.cjs`):

```
GET connectionState/drax-oficial → 200 open
POST /message/sendText/drax-oficial → socket hang up (~7–22s)
POST /message/sendText/walkup → socket hang up
```

`GET fetchInstances` e `GET connectionState` funcionam; **`POST sendText` cai** (socket hang up / ECONNRESET). Não é número de destino inválido — é limite/rede entre Windows dev e `walkup-evo-walkup-api.achpyp.easypanel.host`.

No VPS de produção, o WABA costuma usar Evolution na rede interna (`:30181`), onde `sendText` responde.

## Correções de código (esta sessão)

**Arquivo:** `src/mail/waba-welcome-whatsapp.service.ts`

1. Timeout de envio alinhado ao operacional/aquecedor: `defaultEvoSendTextTimeoutMs()` (90s via `EVO_SEND_TEXT_TIMEOUT_MS`), não 28s fixo.
2. Não pular envio quando `connectionState` retorna vazio (`?`) — só pular em `close` / `connecting` / `pairing` / `qrcode`.
3. Se `filterInstanceNamesTrulyOpen` eliminar todas, **fallback** para candidatas do `fetchInstances` (evita `status: skipped` falso).
4. Ordem de candidatas: primária por telefone → `drax-oficial` (push config) → fallbacks.

**Arquivo:** `.env.v02.example` — documentadas vars `EVO_SEND_TEXT_TIMEOUT_MS` e boas-vindas.

## Como validar

1. `npm run build` e reiniciar `npm run dev:v02`.
2. Admin → Assinantes → reenviar boas-vindas: toast deve mostrar **warning** (e-mail OK, WhatsApp falhou) se POST continuar falhando.
3. Teste CLI:

```powershell
$env:WABA_ENV='v02'
node -r ./dist/load-env.js -e "const { deliverSubscriberWelcomeWhatsApp } = require('./dist/mail/waba-welcome-whatsapp.service'); deliverSubscriberWelcomeWhatsApp({ email:'test', password:'', whatsapp:'51982007943' }).then(console.log)"
```

4. Para envio real no dev local, tunelar Evolution interna:

```powershell
ssh -L 18082:127.0.0.1:30181 root@srv1261237
# .env.v02: EVO_API_URL=http://127.0.0.1:18082
```

Ou validar reenvio em **produção** (`waba.draxsistemas.com.br`), onde o app fala com Evolution na mesma rede.

## Palavras-chave

`boas-vindas`, `welcome-whatsapp`, `51982007943`, `51982006019`, `sendText`, `socket hang up`, `drax-oficial`, `walkup`, `connectionState`, `filterInstanceNamesTrulyOpen`, `V02 local`, `Easypanel`
