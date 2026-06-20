# LOG — Fix QRCode instância (Evolution indisponível)

**Data:** 2026-06-15

## Sintoma
`Gerar QRCode` → toast «Erro ao gerar QRCode da instância» (HTTP 500).

## Causa
1. `fetch` à Evolution falhava (TLS self-signed / rede) e lançava exceção → 500 genérico.
2. `EVO_API_URL` Easypanel (`walkup-evo-walkup-api.achpyp.easypanel.host`) responde **404** em todos os paths — serviço Evolution **fora do ar** ou URL errada.
3. Payload `token` customizado no create podia causar 400 na Evolution.

## Correção
- `src/evo-http.client.ts` — HTTP com `EVO_TLS_INSECURE` (auto em dev + https).
- `callEvoAction` não lança mais em erro de rede.
- `registrar-qrcode`: sem token no create; QR extraído da resposta do create; mensagens 502 claras.
- UI mostra `error`/`detail` da API.
- `.env.v02`: `EVO_TLS_INSECURE=1`.

## Ação operacional
Subir Evolution no Easypanel **ou** apontar `EVO_API_URL` para instância válida (ex. `http://127.0.0.1:8082` local).
