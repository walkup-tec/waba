# Deploy — aquecedor instâncias cache/escopo

**Data:** 2026-06-20  
**Pedido:** commit + push fix aquecedor não reconhece instâncias habilitadas

## Commits (master → origin)

| SHA (assunto) | Conteúdo |
|---------------|----------|
| `2fe10b7` `[2ff29ae]` | fix: cache escopo instâncias + fallback EVO |
| `e4fe82b` `[32c8b6b]` | marker `DEPLOY-2026-06-20-aquecedor-instances-cache-scope` |

## Arquivos

- `src/index.ts` — `listAquecedorScopedInstanceNames`, `resolveAquecedorConnectedForOwner`, cache fallback
- `src/deploy-marker.ts`, `dist/deploy-marker.js`, `dist/index.js`
- `doc/LOG-2026-06-20__aquecedor-instances-cache-scope.md`

## Comandos

```bash
cd D:\Waba
npm run build
git add src/index.ts src/deploy-marker.ts dist/ ...
git commit / push origin master
```

## Validação pós-deploy Easypanel `waba_disparador`

1. `GET https://waba.draxsistemas.com.br/health` → `deployMarker: DEPLOY-2026-06-20-aquecedor-instances-cache-scope`
2. Parar/iniciar Aquecedor; `GET /aquecedor/diagnostico` → `instancias.eligible` ≥ 2 (walkup)

## Pendências

- Merge master → `v02` + redeploy `waba_disparador_v02` (se quiser mesmo fix no ambiente V02)
- Mozart: ativar números na API Alternativa para entrar no escopo
