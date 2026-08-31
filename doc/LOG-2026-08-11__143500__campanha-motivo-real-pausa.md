# LOG — Motivo real da pausa de campanha (API Alternativa)

## Contexto do pedido

Campanhas pausadas (ex.: **Vemm Card 01**) apareciam como «Pausa Manual» / texto genérico, sem informar a causa real (saúde de instâncias, créditos, aguardando ativação).

## Ações executadas

- Investigação da campanha `Vemm Card 01` no Supabase + estado EVO.
- Ajuste em `src/index.ts` para montar detalhe específico de pausa.
- `npm run build` (atualiza `dist/`).

## Solução implementada

1. Função `describeCampaignPauseDetail` / `pauseReasonFromInstanceHealth`:
   - mínimo de conectados (ex.: «apenas 1 de 2… mínimo 4»);
   - ratio ≥50% desconectadas;
   - créditos esgotados;
   - aguardando ativação (criada / `sentCount = 0`);
   - pausa manual explícita.
2. Campo opcional `pauseReason` na campanha (memória + `disparos-local-state.json`).
3. Tick de disparo, créditos e «parar envios» gravam o motivo; ativação limpa o motivo.
4. `GET /disparos/campanhas` → `runtimeStage.detail` usa o texto específico (a UI já exibe esse campo).

## Arquivos criados/alterados

- `src/index.ts`
- `dist/index.js` (build)
- `doc/LOG-2026-08-11__143500__campanha-motivo-real-pausa.md`
- `doc/memoria.md`

## Como validar

1. Redeploy do Node em produção.
2. Abrir lista de campanhas API Alternativa.
3. Em **Vemm Card 01** (ou campanha com &lt;4 conectados / ≥50% off), o status deve mostrar algo como:
   - `Pausada · Pausa automática por saúde: apenas X de Y números conectados (mínimo 4; faltam Z); …% … desconectadas …`
4. Campanha recém-criada sem ativar: `Aguardando ativação…`

## Observações de segurança

Nenhum segredo exposto. Consultas usaram service role apenas localmente para diagnóstico.

## Palavras-chave

`pauseReason`, `describeCampaignPauseDetail`, `runtimeStage`, `Pausa automática por saúde`, `Vemm Card 01`, `shouldPauseByDisconnectedRatio`, `needsMoreInstancesForMinimum`
