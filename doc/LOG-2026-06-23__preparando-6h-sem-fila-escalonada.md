# LOG — Preparando: 6h fixas desde integração (sem fila escalonada)

## Problema

UI mostrava contadores de **23h–35h** em Preparando. Causa: `computePreparingPromoteAtMs` aplicava **fila escalonada** (`lastStaggerPromotionAt + 6h × posição na fila`) além das 6h individuais.

## Regra correta (produto)

1. **Preparando** por exatamente **6 horas** desde a data de integração (`preparingSince`).
2. Durante Preparando: **indisponível** para aquecedor e disparo.
3. Após 6h: status **conectado** (fase `active`) e disponível para ambos.

## Solução

- `computePreparingPromoteAtMs(row)` = `preparingSince + 6h` (sem fila).
- `syncAquecedorPreparingPromotions()` promove **todas** as instâncias vencidas de uma vez.
- `filterInstancesLifecycleReady()` exclui `preparing` do disparador (backend).
- UI: picker de disparo ignora instâncias em Preparando.

## Arquivos

- `src/services/aquecedor-instance-lifecycle.service.ts`
- `src/index.ts`
- `index.html`
- `src/deploy-marker.ts`

## Validação V02

```bash
node -e "require('./dist/services/aquecedor-instance-lifecycle.service.js').syncAquecedorPreparingPromotions().then(console.log)"
# promoted 6 instâncias que estavam presas em preparing há >6h
```

## Palavras-chave

`preparando`, `6h`, `sem-fila`, `filterInstancesLifecycleReady`, `AQUECEDOR_PREPARING_DURATION_MS`
