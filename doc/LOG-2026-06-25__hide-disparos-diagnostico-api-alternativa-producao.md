# LOG: Ocultar Log de diagnóstico na API Alternativa (produção)

## Contexto

Usuário reportou exibição indevida de **«Log de diagnóstico»** na tela de campanhas **API Alternativa** em produção (`waba-ui-production`).

## Causa

CSS expunha elementos `.disparos-evo-baseline-only` também em `body.waba-disparo-evo-mode` — classe ativa na aba API Alternativa em produção — revelando bloco de debug e botão **Diagnóstico** pensados para ambiente **baseline/dev**.

## Solução

- Removida visibilidade via `waba-disparo-evo-mode` para log/botão de diagnóstico.
- Classe extra `disparos-diagnostico-dev-only` no bloco de log.
- Regra explícita: `body.waba-ui-production` oculta log + `#disparos-diagnostico-btn`.
- Diagnóstico permanece disponível só em **baseline** (`WABA_UI_PROFILE=baseline`).

Marker: `DEPLOY-2026-06-25-hide-disparos-diagnostico-producao`

## Arquivos

- `index.html`, `dist/index.html`
- `src/deploy-marker.ts`

## Validar

1. Produção → API Alternativa → Campanhas: **sem** «Log de diagnóstico» nem botão Diagnóstico.
2. Baseline/local dev: bloco e botão continuam visíveis.

## Palavras-chave

disparos-diagnostico, API Alternativa, waba-disparo-evo-mode, disparos-evo-baseline-only, produção
