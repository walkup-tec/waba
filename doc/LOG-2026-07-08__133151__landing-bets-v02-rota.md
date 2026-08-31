# LOG — 2026-07-08 13:31 — Landing Bet Waba no V02 (`/bets`)

## Pedido
Acesso local `http://localhost:3012/version-02/bets` para simular landing bet.waba.info e cadastrar assinante no V02.

## Solução
1. **`public-pages/bets.html`** — landing Bet Waba com formulário de cadastro
   - `POST /subscribers/register` com `segment: "bets"` e `signupOrigin: "bet-waba"`
   - `apiBase` via `window.WABA_BASE_PATH` (injetado pelo servidor)
2. **`src/index.ts`** — rota `GET /bets` → `sendBetsLandingPage()`
3. **`src/auth/waba-auth.routes.ts`** — `/bets` liberado sem login (GET)

## URL
`http://localhost:3012/version-02/bets`

## Validar
1. Abrir URL acima
2. Preencher cadastro → redireciona ao painel V02
3. Admin Assinantes → novo registro com segmento **Bets** em `data/v02/waba-subscribers.json`

## Observação
Produção `https://bet.waba.info/` continua separada; esta rota é só para dev V02.

## Palavras-chave
`bets`, `landing`, `version-02/bets`, `signupOrigin`, `bet-waba`, `public-pages/bets.html`
