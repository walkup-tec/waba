# LOG — Isolar Devices WABA vs SaaS devices.draxsistemas.com.br

## Decisão

O SaaS futuro publica em **https://devices.draxsistemas.com.br/**.

Devices gerados/publicados nesse SaaS **não** aparecem em **https://waba.draxsistemas.com.br/** (aba Dispositivos).

## Como fazer no futuro

1. SaaS usa tenant SSO próprio (`DEVICE_CLOUD_DEFAULT_TENANT_ID` diferente do WABA).
2. Nomes de device SaaS com prefixo `SAAS · ` ou `DRAX-DEVICES · `.
3. WABA já ignora esses prefixos na listagem e na reutilização.
4. Devices criados pelo WABA recebem prefixo `WABA · ` e claim SSO `product: "waba"`.

Hoje a API ainda é compartilhada; o filtro no WABA é a barreira até o tenant separado existir.

## Palavras-chave

`device-cloud`, `tenant`, `SAAS ·`, `WABA ·`, `devices.draxsistemas.com.br`
