# LOG — Sync E:\Waba → D:\Waba (retorno ao escritório)

**Data:** 2026-06-22

## Contexto

Trabalho de 21/06 realizado em `E:\Waba` (backup local). Usuário retornou ao escritório e pediu atualizar `D:\Waba` para continuar operando de lá.

## Ações

1. `robocopy E:\Waba D:\Waba /MIR` com exclusões:
   - `node_modules` (reinstalado com `npm ci`)
   - `.env`, `.env.v01`, `.env.v02` (mantidos os do escritório)
   - `shortener-waba.zip`
2. Log completo: `doc/_sync_E_to_D_waba.log`

## Estado após sync

| Item | Antes (D) | Depois (D) |
|------|-----------|------------|
| HEAD | `513988b` | `571e3ad` |
| Marker | `DEPLOY-2026-06-20-...` | `DEPLOY-2026-06-21-aquecedor-mesh-webhook-verify-v3` |
| Branch | master | master (alinhado origin) |

## Novidades trazidas de E

- Aquecedor mesh bootstrap (start)
- Fix fila multi-instância
- Delivery verify v2 / mesh evo digits / hub-spoke
- Mesh webhook verify v3 (`src/services/aquecedor-mesh-validation.service.ts`)
- LOGs e `memoria.md` de 21/06

## Operar a partir de

**`D:\Waba`** — abrir este path no Cursor/terminal.

## Observações

- `.env` do escritório **não foi sobrescrito** — conferir se variáveis de 21/06 precisam ser replicadas manualmente.
- `shortener-waba.zip` não copiado (artefato pesado).
