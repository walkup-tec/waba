# LOG — Fix QRCode Aquecedor (Evolution timeout)

**Data:** 2026-06-19  
**Sintoma:** Wizard «Conectar instância WhatsApp» → «Evolution API indisponível. Verifique EVO_API_URL no servidor.»

## Causa raiz
- `EVO_API_URL` remoto (`walkup-evo-walkup-api.achpyp.easypanel.host`) **responde**, mas `POST /instance/create` (geração QR) leva **~5–6s**.
- Cliente HTTP usava timeout **12s** com `req.setTimeout` — falhas intermitentes (`status 0`, `timeout` / TLS disconnect) antes de receber o QR.
- Verificação de duplicidade usava `fetch` nativo (sem `EVO_TLS_INSECURE`).

## Correção
- `src/evo-http.client.ts`: timeout padrão **45s** (`EVO_HTTP_TIMEOUT_MS`), `requestOptions.timeout`, limpa timeout após headers, **retry** (até 3x) em erro de rede/5xx.
- `src/index.ts`: `callEvoAction` usa timeout configurável; `registrar-qrcode` com **3 retries** no create/connect; check duplicidade via `evoHttpRequest`.
- `.env.v02` + example: `EVO_HTTP_TIMEOUT_MS=45000`.

## Validação
- `POST /version-02/instancias/registrar-qrcode` (master logado) → **200** + `qrCode` base64 em ~6–10s (3 tentativas seguidas OK após restart).

## Retomada
- Usuário: Ctrl+F5 em http://localhost:3012/version-02/ e testar wizard Aquecedor.
- Se falhar de novo: conferir Evolution no Easypanel (`doc/FIX-TRAEFIK-WALKUP-EVO.md`).
