# Fix: raspagem Leads PJ em paralelo (como V02)

## Pedido
Usuario: nao serializar Chromium; abrir navegador por extracao em paralelo como no localhost V02.

## Evidencia
origin/v02 nunca teve acquirePortalScrapeSlot. Mutex 8a6cb79 foi so producao e atrasava N listas.

## Solucao
Removido mutex; restore do service pre-mutex (mantem clamp maxPages 1000). Jobs voltam a raspar em paralelo.

## Marker
DEPLOY-2026-08-23-leads-pj-scrape-parallel

## Nota
No Docker, muitos Chromiums simultaneos podem voltar a crashar por memoria — comportamento igual ao V02/localhost (sem fila de raspagem).
