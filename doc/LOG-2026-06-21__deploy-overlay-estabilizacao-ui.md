# LOG — Overlay deploy: animação e fechamento só após estabilizar

**Data:** 2026-06-21  
**Marker:** `DEPLOY-2026-06-21-deploy-overlay-estabilizacao-ui`

## Pedido

Remover botão "Tentar agora" do modal de deploy; adicionar gráfico com movimento; ícone mais agradável; fechar modal **somente** quando o sistema confirmar deploy concluído e processamento normalizado.

## Solução (`index.html`)

### UI
- Removido botão manual.
- Ícone SVG (nuvem + setas up/down) com órbitas duplas animadas.
- Barra de progresso indeterminada + três dots pulsando.
- Label de fase: "Atualizando serviços" → "Confirmando estabilidade (n/4)" → "Sistema normalizado".

### Lógica de fechamento
- Poll a cada 2s em `/health` **e** `/ready`.
- Estável = HTTP 200, `ok: true`, sem `shuttingDown`, sem `maintenanceMode`, e `/ready` com `ready: true`.
- Exige **3 probes estáveis consecutivos** (~6s); se cair no meio, zera a contagem.
- Após estabilizar: breve estado "Sistema normalizado" (500ms) e fade do overlay.
- Poll **não para** após 3 min — continua verificando; mensagem informa demora prolongada.

## Validar

1. Redeploy em produção com app aberto ou refresh durante deploy.
2. Overlay aparece com animação contínua (sem botão).
3. Modal só some após ~10s de backend estável (`/health` + `/ready`).
4. `GET /health` → marker acima.

## Palavras-chave

deploy overlay, waba-deploy-overlay, pollUntilReady, STABLE_PROBES, /ready, zero downtime
