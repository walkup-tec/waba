# LOG — persistência prioridade fornecedores

## Contexto

Ao alterar a ordem de prioridade em Admin → Financeiro → Fornecedores, o auto-save falhava porque a API rejeita prioridades duplicadas no mesmo plano/segmento. Após erro 400, a UI recarregava a config antiga — parecia que não persistia.

## Solução

- Swap automático de prioridade entre fornecedores do mesmo grupo (`apiKind` + `segment`) ao mudar o select.
- Validação no frontend antes do PUT (bloqueia duplicatas remanescentes).
- Resolução de conflito ao mudar plano/segmento (próxima prioridade livre).
- Script `npm run verify:supplier-priority`.

## Arquivos

- `index.html` — helpers + handlers
- `scripts/verify-supplier-priority-swap.cjs`
- `package.json`, `src/deploy-marker.ts`, `dist/`

## Validar

```bash
npm run verify:supplier-priority
npm run build
```

Após redeploy: alterar prioridade na UI, recarregar página — ordem deve permanecer.

Marker: `DEPLOY-2026-08-14-supplier-priority-persist`

Palavras-chave: fornecedores, split-config, prioridade, financeiro
