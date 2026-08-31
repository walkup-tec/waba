# LOG — Leads PJ: Xvfb + Chromium headed (paridade V02)

## Contexto
Produção ficava em "Pesquisando: abrindo tela de pesquisa…". V02 localhost funcionava.

## Causa (evidência)
- Headless: título "Um momento…" / "Just a moment…", URL `__cf_chl_*`, body Cloudflare — não limpa em 60s.
- Headed (como V02): limpa em ~0,5s e abre Pesquisa Avançada.

## Solução
- Dockerfile: instala `xvfb`, `DISPLAY=:99`, entrypoint sobe Xvfb.
- Adapter: se há `DISPLAY`, usa `headless:false` (mesmo com `CASADOSDADOS_HEADLESS=1`).
- Anti-bot: espera com progresso e erro claro se não liberar.
- Login: falha se permanecer em `/entrar`.

## Validação
- Probe local headed OK; headless bloqueado.
- Produção: Redeploy da **imagem** Docker (não só FTP) + marker `DEPLOY-2026-08-21-leads-pj-xvfb-headed`.

## Keywords
leads-cnpj, xvfb, headless, casadosdados, cloudflare, v02
