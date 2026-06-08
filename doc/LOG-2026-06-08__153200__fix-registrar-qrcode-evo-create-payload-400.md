# LOG — fix registrar-qrcode Evolution create HTTP 400

**Data:** 2026-06-08

## Contexto

- VPS: `waba.draxsistemas.com.br` + Evolution `172.17.0.1:30181`
- `GET /instancias` e `POST /instancias/:name/qrcode` OK
- `POST /instancias/registrar-qrcode` → 502 `"Dados salvos, mas falha ao gerar QRCode na EVO."`

## Causa raiz

`POST /instance/create` na Evolution com payload do WABA retornava **HTTP 400**:

```json
{
  "name", "instanceName", "channel": "baileys",
  "token": "<auto>", "number": "", "qrcode": true, "integration": "WHATSAPP-BAILEYS"
}
```

Connect imediato → **404** (instância não criada).

Payload manual (sem `channel`, sem `token` auto, sem `number` vazio) → **201**.

## Alteração

- `src/index.ts` — `registrar-qrcode`: enviar à Evolution só campos aceitos (`name`, `instanceName`, `qrcode`, `integration`; `token`/`number` opcionais se informados).

## Validação VPS (pré-deploy)

```bash
# create mínimo → deve 201
# POST registrar-qrcode → ainda falha até redeploy do WABA
```

## Pendência

- Deploy `waba_disparador` com build contendo o fix
- Republicar porta host `30180` se necessário após redeploy
