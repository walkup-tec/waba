# LOG — Estilo número passo 3 + CONFIRMAR v2

**Marker:** `DEPLOY-2026-06-30-validacao-inbound-style-confirmar-v2`

## Problemas

1. Número virou link azul sublinhado (fora do padrão `reg-instruction-highlight`).
2. Validação ainda não detectava CONFIRMAR — filtro `fromMe` rejeitava payloads sem `fromMe: false` explícito.

## Correções

### UI
- Número volta ao badge `reg-instruction-highlight` (igual CONFIRMAR).
- Link «Abrir conversa no WhatsApp» separado, discreto.
- Formato `+55 51 82006-019` (9 dígitos móvel).
- Botão **«Já enviei CONFIRMAR»** → `?nudge=2` (busca agressiva).

### Backend
- `isInboundCandidate`: só rejeita `fromMe === true`.
- Busca jid em subárvore; `findChats` + `findMessages` por chat.
- `resolveInboundHit` com modo agressivo (`nudge=2`).

## Validar

Redeploy → passo 3: número no badge escuro; link wa.me abaixo; enviar CONFIRMAR do outro celular → OK em segundos ou após «Já enviei CONFIRMAR».
