# LOG — Instâncias isoladas por usuário logado

**Data:** 2026-06-16

## Solicitação
Cada usuário só vê instâncias que ele mesmo integrou; não pode ver instâncias de outros.

## Implementação
- `src/instances/waba-instance-ownership.service.ts` — mapa `data/*/instance-owners.json`
- `POST /instancias/registrar-qrcode` — vincula `ownerEmail` ao concluir QR
- `GET /instancias` — filtra lista por dono
- Mutations (`alias`, `delete`, `renomear`, `qrcode`, `validacao-inbound`, etc.) — 403 se não for dono
- **Master** (`role=master` ou `WABA_ADMIN_EMAIL`) vê e gerencia todas (inclui legado sem dono)

## Legado
Instâncias já existentes na Evolution **sem** entrada em `instance-owners.json` ficam visíveis só para **master** até novo registro ou edição manual do JSON.

## Marker
`DEPLOY-2026-06-16-instancias-por-usuario-v1`

## Pendência
Deploy VPS + popular `instance-owners.json` para instâncias antigas se necessário.
