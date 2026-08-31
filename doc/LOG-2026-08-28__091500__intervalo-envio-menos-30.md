# LOG — 2026-08-28 — Intervalo entre mensagens −30%

## Contexto do pedido

Campanha (Corbans / API Alternativa) enviando devagar. Reduzir o intervalo entre cada mensagem em 30% do valor atual (novo intervalo = 70% do anterior).

## Ações executadas

- Constante `CAMPAIGN_SEND_INTERVAL_RATIO = 0.7` em `src/disparos/alternativa-dispatch-rules.ts`.
- `computeAlternativaThrottle` aplica a razão nos delays (8h–22h: ~240–264s → ~168–185s).
- Campanha Alternativa em execução: o tick regrava o snapshot com o throttle novo (não espera recriar a campanha).
- Campanha oficial: o wait usa 70% do `delayMin`/`delayMax` gravados, sem persistir o valor reduzido a cada tick.
- Fallback da UI em `index.html` alinhado à fórmula do backend.
- Marker: `DEPLOY-2026-08-28-091500-intervalo-envio-menos-30`.

## Solução implementada

1. O intervalo por chip continua sendo `scheduleNextCampaignDispatchDelay` (sorteio entre min e max).
2. Teto diário (100/número) e ciclo 60 min liga / 14 min pausa **não** mudaram.
3. “Digitando…” (`computeAlternativaTypingDelayMs`) não foi alterado — não é o intervalo entre leads.

## Arquivos criados/alterados

- `src/disparos/alternativa-dispatch-rules.ts`
- `src/index.ts`
- `src/deploy-marker.ts`
- `index.html`
- `dist/` (após `npm run build`)
- `doc/memoria.md`, `.cursor/project-memory/*`

## Como validar

- `node -e "const m=require('./dist/disparos/alternativa-dispatch-rules.js'); console.log(m.computeAlternativaThrottle({startHour:8,endHour:22}))"` → `delayMinSeconds` ≈ 168, `delayMaxSeconds` ≈ 185.
- Após Redeploy `waba_disparador`: `GET /health` = `DEPLOY-2026-08-28-091500-intervalo-envio-menos-30`.
- Campanha Corbans em execução: o próximo wait após um envio deve cair ~30% (ex.: ~4 min → ~2,8 min por chip).

## Observações de segurança

Nenhum `sendText` de teste. Teto 100/dia por número mantido.

## Palavras-chave

`CAMPAIGN_SEND_INTERVAL_RATIO`, intervalo envio, throttle Alternativa, `scheduleNextCampaignDispatchDelay`, Corbans
