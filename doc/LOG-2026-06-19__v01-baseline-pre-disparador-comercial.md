# LOG — V01 baseline pré-disparador comercial (08/06/2026)

**Data:** 2026-06-19  
**Pedido:** Restaurar V01 ao estado anterior à criação dos ambientes V01/V02 e ao desenvolvimento do disparador SaaS atual.

## Data de referência

- **08/06/2026 13:33** — commit `50c41f3` (criação V01/V02)
- Estado alvo: commit pai `06c8e752` (menu **API não oficial** + **API Meta**)

## Estrutura restaurada no V01

| Bloco | Conteúdo |
|-------|----------|
| **API não oficial** | Dashboard, Instâncias, **Aquecedor**, **Disparos** (EVO) |
| **API Meta** | 1) Ativos API, 2) Templates, 3) Disparo API (oficial) |

Toggle superior: **API não oficial** ↔ **API Meta**  
Oculto no V01: `disparos-dashboard`, `disparos-lancamento`, `campanhas` (fluxo comercial pós-08/06).

## Implementação

- `WabaUiProfile`: novo valor `baseline`
- `resolveUiProfile()`: `WABA_ENV=v01` → `baseline`
- `index.html`: `initBaselineUi()`, labels antigos, `filterMenusForCurrentUiProfile` sem menus SaaS
- `.env.v01`: `WABA_UI_PROFILE=baseline`

V02 e produção **inalterados** (`production`).

## Validar

1. `npm run dev:v01`
2. http://localhost:3011/version-01/
3. `/health` → `"uiProfile":"baseline"`
4. Menu lateral: grupos **API não oficial** e **API Meta**
5. Sem itens Dashboard/Disparos comercial na seção Disparos SaaS
