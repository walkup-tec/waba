# LOG — Leads PJ: copiar todas as páginas antes do ReceitaWS v9.12

## Problema

Histórico mostrou `118/1000` + Excel ready + “Pool esgotado” enquanto a raspagem ainda não terminou.
Causa: enrich iniciava quando `pool >= dailyLimit`, pulando o restante das páginas.

## Correção

1. **Sempre** copiar o portal até `scrapeCompleted` (teto UI 1000 / fim real) **antes** do enrich.
2. Trava pré-`takeFromPool`: se a campanha não concluiu a cópia → status scraping e retoma.
3. Mensagem: “Pool esgotado” só com raspagem concluída; senão avisa que o lote do dia acabou mas a cópia continua.
4. Hop de paginação: timeout Node + aborta se o botão não avança (evita 555s em “aproximando via botão 2”).

Inclui também UI download azul/verde (v9.11) se ainda não publicada.

Marker: `DEPLOY-2026-08-24-1045-leads-pj-copia-antes-enrich-v9.12`

## Palavras-chave

`118/1000`, `Pool esgotado`, `scrapeCompleted`, `copia antes enrich`, `v9.12`
