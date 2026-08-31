# LOG — Cadastro Bets: e-mail OK, WhatsApp boas-vindas falhou (Evolution)

**Data:** 2026-07-08  
**Contexto:** Cadastro `mozart.hotmart@gmail.com` em `/version-02/bets` — e-mail de boas-vindas recebido; WhatsApp não chegou em `(51) 98200-7943` (`51982007943`).

## Diagnóstico

O fluxo de cadastro **dispara** WhatsApp via `notifySubscriberWelcomeEmail` → `notifySubscriberWelcomeWhatsApp` (`src/mail/waba-welcome-whatsapp.service.ts`).

Logs do V02 (`terminals/418896.txt`):

```
[mail] boas-vindas mozart.hotmart@gmail.com enviado para mozart.hotmart@gmail.com
[whatsapp] boas-vindas: primária 51981077770 indisponível; usando walkup (5197462102).
[whatsapp] boas-vindas tentativa falhou (walkup) para 51982007943: socket hang up
```

**Causa:** falha de rede/conexão com a API Evolution (`EVO_API_URL` Easypanel) a partir do ambiente local V02 — não é ausência de chamada no código. Testes manuais repetidos falharam (`socket hang up`, `ECONNRESET`, TLS disconnect) em `walkup` e `drax-oficial`.

Número gravado no assinante: `51982007943` (correto).

## Melhorias aplicadas

1. **`waba-welcome-whatsapp.service.ts`** — lista várias instâncias candidatas (primária + fallback + push); erros de rede (`socket hang up`, `timeout`, `ECONNRESET`) tentam próxima instância; 2 retries por envio.
2. **`evo-text-alert.client.ts`** — parâmetro `retries` configurável.
3. **`waba-subscriber.service.ts`** — `loginUrl` no e-mail/WhatsApp de boas-vindas via `resolveWabaAppLoginUrl()`.

## Como reenviar

1. Login master no V02 → **Admin → Assinantes** → ícone reenviar boas-vindas em `mozart.hotmart@gmail.com`.
2. Ou aguardar Evolution estável e repetir cadastro/teste.

## Validação

```powershell
$env:WABA_ENV='v02'
node -e "const { deliverSubscriberWelcomeWhatsApp } = require('./dist/mail/waba-welcome-whatsapp.service'); deliverSubscriberWelcomeWhatsApp({ email:'mozart.hotmart@gmail.com', password:'***', whatsapp:'51982007943' }).then(console.log)"
```

Se Evolution responder: `status: "sent"`.

## Palavras-chave

`boas-vindas`, `welcome-whatsapp`, `socket hang up`, `walkup`, `drax-oficial`, `bets-cadastro`, `mozart.hotmart`
