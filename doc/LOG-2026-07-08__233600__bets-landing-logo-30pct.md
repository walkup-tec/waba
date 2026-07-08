# LOG — Landing Bets logo +30% e deploy

**Data:** 2026-07-08

## Pedido

Aumentar logo DRAX.bets em 30%, commit + push deploy. Revisar outras pendências da landing no mesmo commit.

## Baseline (produção bet.waba.info)

- Header: `h-[2.5875rem]` (41px) — referência do site React `bets_pv`
- Footer: `h-9` (2.25rem / 36px)

## Solução (WABA `public-pages/bets.html`)

| Local | Antes | Depois (+30%) |
|-------|-------|----------------|
| Header | texto "Drax Bets" | imagem `media/drax-bets-logo.png` **3.36375rem** (269×53) |
| Footer | sem logo | mesma imagem **2.925rem** (234×47) |

Asset baixado de `https://bet.waba.info/assets/drax-bets-logo-OlX2YEjR.png` (mesma arte).

## Outras pendências landing (auditoria)

Já presentes no `bets.html` commitado — **nenhuma alteração extra** necessária:
- Preço a partir de **R$ 0,33**
- Máscaras telefone/CPF + cadastro `POST /subscribers/register` segmento Bets
- `signupOrigin: bet-waba`

## Arquivos

- `public-pages/bets.html`
- `media/drax-bets-logo.png`
- `Dockerfile` — COPY explícito da logo
- `src/deploy-marker.ts` — `DEPLOY-2026-07-08-bets-landing-logo-30pct`

## Validar

- V02: `http://localhost:3012/version-02/bets` — logo maior no header/footer
- Produção WABA `/bets` após deploy Easypanel/FTP
- **Nota:** `bet.waba.info` (app React `bets_pv`) é deploy separado no Easypanel; este commit atualiza a rota `/bets` do WABA e cópia da arte em `media/`.

## Palavras-chave

`drax-bets-logo`, `bets.html`, `landing`, `logo 30%`, `3.36375rem`
