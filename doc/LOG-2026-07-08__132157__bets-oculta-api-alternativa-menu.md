# LOG — 2026-07-08 13:21 — Bets: ocultar API Alternativa no menu

## Pedido
Assinante `digitalcorban@gmail.com` (segmento **Bets**) via **API Alternativa** no menu — incorreto; Bets deve usar só **API Oficial**.

## Causa raiz
1. `initUiProfile()` rodava **depois** do login e restaurava `localStorage.waba.integration.env = "alternativa"` sem checar segmento.
2. `syncIntegrationEnvAccess()` exibia o botão Alternativa na faixa superior para qualquer assinante em produção.
3. Classe `waba-subscriber-bets-segment` existia mas **sem CSS** para esconder itens.
4. `normalizeIntegrationEnv()` não bloqueava `alternativa` para Bets.

## Correção (`index.html`)
- `normalizeIntegrationEnv` / `selectDisparosApiKind`: Bets → força `oficial`
- `enforceBetsSubscriberIntegrationEnv()`: corrige env/tabs/localStorage ao detectar Bets
- `syncIntegrationEnvAccess`: oculta botão Alternativa para Bets
- `initUiProfile`: normaliza env salvo + `enforceBetsSubscriberIntegrationEnv()`
- CSS `body.waba-subscriber-bets-segment`: esconde Alternativa (faixa, menu, pricing, card créditos)
- Clique na faixa Alternativa: toast de aviso para Bets

## Dado
`data/v02/waba-subscribers.json` — `digitalcorban@gmail.com` já com `"segment": "bets"`.

## Validar
1. Ctrl+F5 → login como `digitalcorban@gmail.com`
2. Menu/faixa: só **API Oficial** (sem Alternativa)
3. Ambiente atual não deve mostrar "API Alternativa"

## Palavras-chave
`segment`, `bets`, `digitalcorban`, `API Alternativa`, `normalizeIntegrationEnv`, `waba-subscriber-bets-segment`
