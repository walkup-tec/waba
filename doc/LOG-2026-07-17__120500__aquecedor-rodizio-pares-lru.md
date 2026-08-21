# LOG — Aquecedor: rodízio LRU de pares (equidade contínua)

**Data:** 2026-07-17 12:05 BRT  
**Marker:** `DEPLOY-2026-07-17-aquecedor-rodizio-pares-lru`

## Contexto do pedido

Após o fix da janela de equidade 24h (`f4a51b0`), o comportamento inverteu: desde ~10:34 BRT o par `soma ↔ walkup` monopolizou o ciclo e `Drax (1321-01) ↔ walkup` parou. O usuário definiu o requisito: **todos os pares devem enviar/receber entre si em quantidades próximas, continuamente** — não “compensar” um par ficando horas só nele.

## Causa

O score de equidade priorizava o par com **menor volume acumulado** na janela. `soma↔walkup` estava atrasado (parado desde 08/07), então o algoritmo ficou preso nele até igualar o volume — starvation invertida.

## Solução — rodízio LRU por par

Novo score em `scoreEquityCombination` / `pickAquecedorCombinationAsync` (`src/index.ts`):

1. **Anti-repetição** (`+1e18`): o par que acabou de trocar mensagem cede a vez (se for o único elegível, ainda sai).
2. **LRU por par** (`recencyMinutes * 1e12`): o par que trocou há **mais tempo** vai primeiro → todos os pares circulam continuamente.
3. Volume do par na janela 24h, directed, origem/destino — desempates.
4. `owesPairReply` (-500) e rotação — desempates finais.

## Validação (simulação com dados reais)

`node scripts/simulate-aquecedor-pick.cjs D:/Waba/.env` — projeção dos próximos 12 envios:

```
soma→1321-01, 1321-01→walkup, soma→walkup, walkup→1321-01, 1321-01→soma,
soma→1321-01, 1321-01→walkup, walkup→soma, walkup→1321-01, 1321-01→soma,
soma→walkup, soma→1321-01
```

Os 3 pares alternam a cada envio; direções também alternam (A→B, depois B→A).

## Arquivos

- `src/index.ts`, `dist/index.js` (compilado via `D:\Waba` — `node_modules` do H: corrompidos pelo Drive)
- `src/deploy-marker.ts`, `dist/deploy-marker.js`
- `scripts/simulate-aquecedor-pick.cjs` (espelha o algoritmo + projeção de 12 envios)

## Como validar em produção

1. Redeploy `waba_disparador`; `/health` → `deployMarker: …rodizio-pares-lru`.
2. Envios: os 3 pares (Drax↔walkup, soma↔walkup, soma↔Drax) devem alternar a cada ciclo.

## Keywords

`aquecedor`, `equidade`, `rodízio`, `LRU`, `par monopolizando`, `soma`, `walkup`, `1321-01`, `Drax`, `starvation`
