# LOG — 2026-07-08 09:00 — Regra Cursor: estudar docs upstream obrigatório

## Contexto
- Após incidente Traefik/landings: agente alterou infra sem ancorar na doc oficial (static vs dynamic).
- Pedido: tornar rotina no Cursor estudar documentação das aplicações usadas no stack.

## Implementado
1. **Nova regra always-apply:** `.cursor/rules/study-upstream-docs.mdc`
   - Quando: Traefik, Easypanel, Docker, Supabase, n8n, Evolution, SDKs externos…
   - Rotina: identificar produto/versão → ler doc → classificar modelo → confrontar ambiente → só então codar
   - Checklist na resposta: URLs oficiais + conceito decisivo
   - Mapa de docs do stack WABA
   - Anti-padrões (patch format errado, force Traefik, kill docker-proxy sem prova)
   - **Rule vs MD:** Rule = enforcement automático; MD = detalhe (agente pode não abrir). Lição permanente → Rule + LOG.
2. **Hook em** `.cursor/rules/context-autopick.mdc` — dispara a regra quando o pedido toca software de terceiro.
3. **Complemento (mesmo dia):** `.cursor/rules/ucp-traefik-static-dynamic.mdc` (alwaysApply) — static vs dynamic + formato Easypanel sem depender de abrir FIX-*.md.

## Como validar
- Em chat novo que cite Traefik/Supabase/etc., o agente deve abrir doc oficial antes de patch.
- Abrir Settings → Rules e confirmar `study-upstream-docs` com Always Apply.

## Palavras-chave
cursor rules, study upstream docs, static vs dynamic, documentação obrigatória, prevenção de erro
