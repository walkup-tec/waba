# LOG: Fluxo de tokens Meta via API (app + System User)

## Pedido

Seguir fluxo **1) token temporário (aplicativo)** e **2) token permanente (System User)** pelo sistema Waba, via API.

## Implementação

### Backend (`src/index.ts`)

- `POST /meta-oficial/tokens/app-access` — corpo: `appId`, `appSecret` → `GET .../oauth/access_token?grant_type=client_credentials`.
- `POST /meta-oficial/tokens/system-user-access` — corpo: `appId`, `appSecret`, `systemUserId`, `adminAccessToken`, opcional `setTokenExpiresIn60Days`, opcional `scopes` → `POST .../{systemUserId}/access_tokens` com `application/x-www-form-urlencoded`, `appsecret_proof` = HMAC-SHA256 do token administrativo com o app secret (documentação Business Management APIs).

Segredos não são logados. Erros retornam `detail` truncado sem token.

### Frontend (`index.html`)

- Etapa **1)** substituída por **1.a** (gerar token de aplicativo) e **1.b** (gerar token System User e preencher campo da etapa 2).
- Etapa **2)** label do campo de token atualizada para refletir uso do 1.b ou colagem manual.

## Limitações (Meta)

- O token do **1.a** não substitui o **adminAccessToken** do 1.b: a Meta exige token de **admin BM / system user** para `access_tokens` do System User.
- System User precisa ter o **app instalado** (`POST /{system-user-id}/applications`) antes do 1.b — processo pode ser feito por API ou BM UI (fora deste escopo mínimo).

## Validação

- `npm run build`
- Chamadas com App ID/Secret válidos de app Meta; para 1.b, System User + admin real conforme BM.

## Palavras-chave

`meta-oficial/tokens/app-access`, `meta-oficial/tokens/system-user-access`, `appsecret_proof`, system user access_tokens
