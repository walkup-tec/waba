# LOG — Handoff técnico nos Detalhes (Logs Sistema)

**Data:** 2026-07-13 12:05  
**Pedido:** Mais detalhes no detalhamento para enviar a dev backend/rede ou agente de IA.

## Solução
- Brief markdown com evento, alvo/URL, probe, falhas, peers down, stack VPS, playbook e comandos
- Novos campos no evento: `handoff`, `probeDetail`, `targetUrl`, `peersDown`, …
- API devolve `handoffBrief` (regenera para eventos antigos)
- UI: resumo + **Ver handoff** + **Copiar handoff**; Excel exporta coluna Handoff
- Uptime passa URL, consecutiveFailures e peersDown ao gravar

Marker: `DEPLOY-2026-07-13-logs-handoff-tecnico`

## Keywords
`logs-sistema`, `handoff`, `detalhes`, `playbook`, `copiar`
