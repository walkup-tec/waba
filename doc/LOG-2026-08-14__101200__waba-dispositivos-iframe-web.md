# LOG — WABA Dispositivos abre UI Device Cloud

## Contexto

`https://devices.draxsistemas.com.br` já estava no ar. O menu Aquecedor → Dispositivos no WABA não carregava a tela do Android sozinho. Se `DEVICE_CLOUD_PUBLIC_URL` apontasse para `api-devices`, o iframe abria a API.

## Solução

- Resolver URL da UI: `DEVICE_CLOUD_WEB_URL`, ou reescrever `api-devices` → `devices`.
- Ao abrir a aba Dispositivos, gerar SSO e embutir o iframe automaticamente.

## Marker

`DEPLOY-2026-08-14-device-cloud-web-iframe`

## EasyPanel

`DEVICE_CLOUD_SSO_SECRET` igual ao worker. `DEVICE_CLOUD_PUBLIC_URL` pode ser `https://devices.draxsistemas.com.br` (preferido) ou `https://api-devices.draxsistemas.com.br` (fallback reescreve).
