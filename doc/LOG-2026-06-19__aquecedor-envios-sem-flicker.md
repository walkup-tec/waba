# LOG — Aquecedor envios sem flicker

**Data:** 2026-06-19  
**Sintoma:** Lista "Envios" some e volta a cada poucos segundos com "Falha ao carregar envios."

## Causa

1. `GET /aquecedor/envios` chamava **Evolution API** a cada poll (8s) + várias queries Supabase → resposta lenta/timeout.
2. UI substituía a lista inteira por erro em qualquer falha transitória.

## Correção

- API usa `controle_instancia` + `pickAquecedorCombinationAsync` (sem EVO na listagem).
- Removido reset PROCESSANDO da rota de listagem.
- UI mantém última lista válida (stale-while-revalidate) e ignora respostas antigas.
- Timeout do fetch: 10s → 20s.

## Marker

`DEPLOY-2026-06-19-aquecedor-envios-sem-flicker`
