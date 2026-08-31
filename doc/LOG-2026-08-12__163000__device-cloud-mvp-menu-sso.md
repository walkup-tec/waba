# LOG — DRAX Device Cloud MVP + menu WABA

## Contexto

Plataforma Device Cloud (repo próprio) + entrada no WABA Aquecedor → Dispositivos (produção, `mozart.pmo@gmail.com`).

## Entregue

### Repo `D:\01A-Drax-Servidor\drax-device-cloud`
- Monorepo NestJS API + packages domain/application/provider/infra
- RedroidProvider (`simulate` / `docker`)
- Next.js dashboard
- Compose Postgres/Redis/RabbitMQ/MinIO + Redroid worker compose
- Docs architecture + ADRs
- Testes unitários + smoke create/start/stop/delete

### WABA
- Menu `dispositivos` abaixo de Dashboard
- Gate production + allowlist Mozart
- `POST /device-cloud/sso`
- Marker `DEPLOY-2026-08-12-device-cloud-menu-sso`

## Validar
1. Device Cloud: `REDROID_MODE=simulate npm run start:api` + `npm run start:web` + smoke
2. WABA produção: Redeploy; login Mozart → Aquecedor → Dispositivos
3. Host KVM: `REDROID_MODE=docker` + `infra/redroid/docker-compose.yml`

## Palavras-chave
`device-cloud`, `dispositivos`, `redroid`, `mozart.pmo`, `sso`
