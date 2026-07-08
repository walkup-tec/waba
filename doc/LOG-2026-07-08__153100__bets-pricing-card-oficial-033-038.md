# LOG — Bets: card API Oficial — faixa 0,33–0,38 e texto de pacotes

**Data:** 2026-07-08  
**Contexto:** Assinantes segmento Bets devem ver no card API Oficial: **"De 0,33 a 0,38"** e **"Escolha o melhor pacote para você"** (sem valor mínimo R$ 320).

## Solução

**Arquivo:** `index.html` — `syncDisparosPricingBoardForSegment()`

Quando `isBetsSubscriberAccount()`:
- `.disparos-api-price` → `De 0,33 a 0,38`
- `.disparos-api-min-creditos` → `Escolha o melhor pacote para você`

Demais segmentos mantêm `De R$ 0,25 a R$ 0,32` e mínimo R$ 320.

## Validar

Login assinante Bets → Disparos / contratar créditos → card API Oficial com textos novos.

## Palavras-chave

`bets`, `syncDisparosPricingBoardForSegment`, `disparos-api-price`, `0,33`, `0,38`
