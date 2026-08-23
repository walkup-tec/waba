# Fix: mutex raspagem Leads PJ (1 Chromium)

## Sintoma
Varias listas em "Abrindo Portal"; Page crashed / browser closed no goto do Casa dos Dados.

## Causa
Fila diaria serializa so o enriquecimento. createAndStart enfileirava N jobs em paralelo, cada um abrindo Chromium/Xvfb no Docker → crash por memoria/CPU.

## Solucao
acquirePortalScrapeSlot no service: 1 scrape Playwright por vez; demais aguardam com "Fila de raspagem (1 Chromium por vez)".

## Operacional
Listas travadas de 2026-08-23 foram excluidas em producao para parar os Chromiums.

## Marker
DEPLOY-2026-08-23-leads-pj-scrape-mutex

## Validar
1. Deploy FTP + Redeploy waba_disparador (codigo Node).
2. Extrair UMA lista; depois criar varias — so uma em Abrindo Portal/Copiando por vez.
