# LOG — wabadisparos ainda sem formulário (redeploy pendente)

## Sintoma (2026-07-14)
Screenshot + live: seção `#cadastro` ainda mostra **"Comece Hoje Mesmo."** + botão **"Criar Conta Gratuitamente →"** (`href="#cadastro"`) — loop sem formulário.

## Diagnóstico
| Check | Resultado |
|-------|-----------|
| HTML live | `Comece Hoje Mesmo` = true; `RegisterForm` / `Crie sua conta em minutos` = false |
| Asset | `/assets/index-CQo76CWe.js` (build antigo) |
| `POST /api/subscribers/register` | **404** (proxy do fix não está no container) |
| Git `pv-waba-disparador` | `3826a02` form+proxy OK; trigger `c7fb6f0` pushed |

**Causa:** serviço Easypanel **`waba_paginadevendas`** não foi rebuildado após o fix. Redeploy do `waba_disparador` não atualiza a landing.

## Ação
1. Push trigger: `c7fb6f0` em `main` (FORCE-REDEPLOY-2026-07-14-cadastro-form)
2. Se auto-deploy não pegar → **Redeploy manual** no Easypanel → app `paginadevendas` / serviço `waba_paginadevendas` (repo `pv-waba-disparador`, branch `main`)

## Validação pós-redeploy
```bash
curl -sS https://wabadisparos.com.br/ | grep -E 'Crie sua conta em minutos|Comece Hoje Mesmo'
# esperado: só "Crie sua conta em minutos"

curl -sS -o /dev/null -w "%{http_code}\n" -X POST https://wabadisparos.com.br/api/subscribers/register \
  -H 'Content-Type: application/json' -d '{}'
# esperado: 4xx da API WABA (não 404 HTML)
```

## Workaround imediato
https://waba.draxsistemas.com.br/cadastro

## Keywords
wabadisparos, cadastro, Comece Hoje Mesmo, paginadevendas, 3826a02, c7fb6f0
