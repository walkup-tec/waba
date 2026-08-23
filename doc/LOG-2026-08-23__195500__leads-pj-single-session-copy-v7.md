# LOG — Leads PJ: uma sessão Chromium até copiar as páginas

## Pedido

Fluxo: CNAE → resultados → copiar → próxima página → copiar… até ~1000. Sem travar, sem fechar Chromium, sem refazer CNAE a cada falha.

## Antes

Página vazia / falha de “next” **lançava erro** → wrapper reabria portal → login + CNAE de novo → `aguardando resultados`.

## Agora

1. Página vazia: relê 3× e **avança na mesma sessão** (3 vazias seguidas = fim limpo).
2. Falha de paginação: retry + salto DOM; se não avançar, **encerra com o já copiado** (não reconecta).
3. Wrapper só reabre Chromium se **Target crashed** / browser morto.
4. Service: cópia incompleta mantém checkpoint e reagenda (não vai enrich cedo).
5. Marker: `DEPLOY-2026-08-23-1955-leads-pj-single-session-copy-v7` (+ dist).

## Validar

Redeploy → Corban deve mostrar `Copiando: página N` em sequência sem `falha operacional — retomando` / sem CNAE de novo a cada página.
