# LOG — V02 com UI igual produção

**Data:** 2026-06-08  
**Pedido:** Ambiente V02 igual ao ambiente de produção (UI).

## Alterações

| Arquivo | Mudança |
|---------|---------|
| `src/index.ts` | `resolveUiProfile()`: V02 → `production`; V01 → `full`; override `WABA_UI_PROFILE` |
| `src/index.ts` | `/health` expõe `uiProfile` |
| `.env.v02.example` | `WABA_UI_PROFILE=production` |
| `doc/AMBIENTES-V01-V02.md` | Tabela UI + env Easypanel V02 |

## Comportamento

- **Produção** e **V02**: menu reduzido — Dashboard, Instâncias, AQUECEDOR, DISPAROS (lançamento em breve).
- **V01**: menu completo (baseline técnico).
- Dados e Evolution continuam isolados (`data/v02/`, `.env.v02`).

## Validar local

```powershell
cd D:\Waba
npm run dev:v02
curl.exe http://localhost:3012/version-02/health
# uiProfile: "production"
```

Abrir http://localhost:3012/version-02/ — rótulos AQUECEDOR / DISPAROS.

## Diagnóstico (usuário: “ainda não está como produção”)

| URL | Resultado |
|-----|-----------|
| `https://waba.draxsistemas.com.br/version-02/health` | **404** — serviço/Traefik V02 **não existe** no VPS |
| `https://waba.draxsistemas.com.br/health` | 200 (produção) |
| `http://localhost:3012/version-02/health` (servidor novo) | `uiProfile: production` |

Causas: (1) URL pública sem deploy; (2) servidor local antigo na porta 3012 com código anterior (`WABA_UI_PROFILE=full`).

## Correções adicionais

- `scripts/free-port.ps1` + `dev-v02.ps1` mata processo na 3012 antes de subir
- `src/index.ts` static assets com `requestUnderBasePath` (fix `/version-02/…`)
- `.env.v02` com `WABA_UI_PROFILE=production`

## Pendências

- Deploy Easypanel `waba_disparador_v02` + Traefik PathPrefix `/version-02` (doc `TRAEFIK-WABA-VERSION-PATHS.md`)
