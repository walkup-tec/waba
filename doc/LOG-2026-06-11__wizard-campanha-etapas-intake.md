# LOG — wizard campanha em etapas + intake

**Data:** 2026-06-11  

## Pedido
Configurar campanha em etapas: nome, DDD, imagem 1080×1080, 3 textos, Excel de leads → **Gerar Campanha** → mensagem de time trabalhando.

## Backend
- `POST /disparos/campanhas/intake` (multipart, auth)
- `waba-campaign-intakes.json` + arquivos em `data/{env}/campaign-intakes/{id}/`

## Frontend
- Wizard 5 etapas em `disparos-config-panel` (aba Campanhas)
- Config legada oculta em `#disparos-config-legacy`

## Arquivos
- `src/disparos/waba-campaign-intake.*`
- `src/index.ts`
- `index.html`
