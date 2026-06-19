# LOG — fix card Admin no canto (HTML quebrado)

**Data:** 2026-06-11

## Causa raiz
`</div>` extra no fim de `#tab-disparos` (linha ~6873) fechava `<main>` antes da hora. Painéis `tab-meta-ativos`, `tab-admin-*` etc. viravam filhos diretos de `<body>`.

Com `body { display: flex }` (row), `.shell` encolhia (~452px) e os painéis admin apareciam no canto superior direito.

## Correção
- `index.html`: remover `</div>` extra em `#tab-disparos`
- `body`: `flex-direction: column` + `.shell { flex: 1 1 auto }`
- CSS admin centering mantido (`admin-section-active`)

## Validação (Playwright 1440×900)
- shell: 1408px | main: 1316px | painel: 1180px centralizado
- `#tab-admin-usuarios`.parent = `waba-main`

## Deploy marker
`DEPLOY-2026-06-11-fix-html-main-fechado-cedo-v1`
