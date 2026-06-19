# LOG — Aquecedor: turno obrigatório (anti-conversa unilateral)

**Data:** 2026-06-18

## Regra de negócio
Mesma origem **não pode** enviar de novo para o mesmo destino sem o destino ter respondido antes.

## Implementação
- `verifyAquecedorConversationTurn()` — releitura do histórico imediatamente antes do envio
- `buildAquecedorInstanceCanonicalMap()` — unifica `drax` / `drax-sistemas` / aliases
- Histórico mescla `logs_envios` + `aquecedor` ENVIADO sempre
- Mensagem de bloqueio explícita no status do motor

## Marker
`DEPLOY-2026-06-18-aquecedor-turno-resposta`
