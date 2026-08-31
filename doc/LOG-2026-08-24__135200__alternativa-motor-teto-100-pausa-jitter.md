# LOG — 2026-08-24 — Motor Alternativa: teto 100/dia e pausa ±30%

## Contexto do pedido

Ajustar o motor de envio das campanhas API Alternativa:

1. Reduzir o teto de 300 para **100 mensagens/dia por número**.
2. Manter a pausa-base de **14 minutos**, mas cada ciclo deve sortear duração entre **−30% e +30%** desse valor (≈ 9,8–18,2 min), de forma aleatória e estável no ciclo.

## Ações executadas

- Alterado `src/disparos/alternativa-dispatch-rules.ts` (constante diária + state machine da janela liga/pausa).
- Fallback da UI em `index.html` (`ALTERNATIVA_DISPATCH_RULES_FALLBACK.maxSendsPerDayPerNumber`).
- `npx tsc` e `node scripts/copy-index-html.mjs`.

## Solução implementada

1. `ALTERNATIVA_MAX_SENDS_PER_DAY_PER_NUMBER = 100`. O throttle derivado (8h–22h) passa a ~240–264 s entre envios, 8/hora, 100/dia.
2. `ALTERNATIVA_BURST_OFF_VARIATION_RATIO = 0.3`. A cada entrada na fase OFF, `rollAlternativaBurstOffDurationMs()` sorteia um valor contínuo em `[14×0,7 ; 14×1,3]` minutos. O valor **não** é re-sorteado a cada tick do motor.
3. `isAlternativaBurstWindowOpen` deixou de usar módulo fixo de 74 min; passou a máquina de estados ON 60 min / OFF sorteado.
4. Meta da API inclui `burstOffVariationRatio`, `burstOffMinMinutes` e `burstOffMaxMinutes`.

## Arquivos criados/alterados

- `src/disparos/alternativa-dispatch-rules.ts`
- `index.html`
- `dist/disparos/alternativa-dispatch-rules.js` (gerado)
- `dist/index.html` (cópia)

## Como validar

- `node -e "require('./dist/disparos/alternativa-dispatch-rules.js').computeAlternativaThrottle({startHour:8,endHour:22})"` → `maxPerDayPerInstance: 100`.
- Campanha Alternativa em execução: após ~60 min enviando, a pausa deve variar em torno de 14 min (não sempre 14).
- Projeção da UI: “máx. 100 envios/dia por número”.

## Observações de segurança

Nenhuma credencial alterada.

## Palavras-chave

`alternativa-dispatch-rules`, teto 100/dia, burst off jitter ±30%, `isAlternativaBurstWindowOpen`, throttle 240-264s
