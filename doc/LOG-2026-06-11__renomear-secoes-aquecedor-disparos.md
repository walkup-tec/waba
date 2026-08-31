# LOG — renomear seções Aquecedor / Disparos

**Data:** 2026-06-11

## Pedido
Substituir nomes antigos das seções: **API não oficial** e **Disparos / API Meta**.

## Novos nomes
| Antes | Depois |
|-------|--------|
| API não oficial | Aquecedor |
| Disparos / API Meta (registry) / API Meta (menu) | Disparos |

## Arquivos
- `src/menus/waba-menu-registry.ts` — `SECTION_LABELS`
- `index.html` — sidebar, toggle ambiente, `integrationEnvLabel` (modo full)

Produção (`initUiProfile`) já usava AQUECEDOR / DISPAROS no menu — mantido.

## Follow-up (checklist ainda antigo)
- `WABA_MENU_SECTION_LABELS` no `index.html` força **Aquecedor** / **Disparos** no checklist (ignora API em cache)
- `npm run build` sincronizou `dist/index.html`

## Validação
Ctrl+F5 → Admin → Usuários → grupos **AQUECEDOR** e **DISPAROS** (CSS uppercase).
