# Push unificado — pareamento + chip 7770

## Contexto

Um único commit/`origin/master` com as duas correções da manhã de 28/08, marker novo para Redeploy EasyPanel.

## O que entra

1. Tick/campanha não faz `proxy/set` em sessão já `open` (queda de pareamento).
2. Chip da campanha vermelho só com `close` explícito; «+ Instâncias» inclui spare sem remover número ainda no ar (WB-7770/`drax`).

## Marker

`DEPLOY-2026-08-28-083300-keep-pairing-chip-live`

Validar: `GET https://waba.draxsistemas.com.br/health` após Redeploy `waba_disparador`.

## Palavras-chave

keep-pairing, chip 7770, proxy/set, + Instâncias, deploy marker
