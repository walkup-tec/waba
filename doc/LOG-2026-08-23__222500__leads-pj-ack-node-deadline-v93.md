# LOG — Leads PJ ACK Node deadline v9.3

## Problema

Após mouse.click: `SEARCH: aguardando ACK (mouse) — 5s… — 141s`.
`waitForSearchAck` usava `page.waitForTimeout` + `probeSearchState` na fila CDP — probe travava e o deadline de 5s nunca era observado.

## Fix

- `withNodeTimeout` (setTimeout Node)
- ACK com probe leve (`probeSearchAckLite`) + sleep Node
- Cada tick de probe com teto ~1.2s
- mouse.click / DOM / Enter também com teto Node
- Marker: `DEPLOY-2026-08-23-2225-leads-pj-ack-node-deadline-v9.3`
