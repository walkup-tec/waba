# LOG — Restart EVO destravou QR (create/connect)

- **Data:** 2026-07-21 ~20:40
- **Sintoma UI:** «Sistema WABA - Drax indisponível. Verifique EVO_API_URL no servidor.» no modal QR
- **Causa real:** `POST /instance/create` e `GET /instance/connect` (instância close) **travavam** na Evolution; `EVO_API_URL` do WABA estava OK (`http://172.17.0.1:30181`)
- **Ação (aprovada):** `docker service update --force walkup_evo-walkup-api`
- **Nota:** curl em `127.0.0.1:30181` no host pode dar connection refused (hairpin); usar `172.17.0.1:30181` ou IP público
- **Validação pós-restart:** create `diagqr-ok` → **201 ~5.3s** com `qrcode.base64`; delete OK; create2 também 201
- **Próximo passo usuário:** Atualizar QR no painel WABA

## Palavras-chave

evo create hang, connect timeout, force walkup_evo-walkup-api, QR 502 falso EVO_API_URL, hairpin 127.0.0.1:30181
