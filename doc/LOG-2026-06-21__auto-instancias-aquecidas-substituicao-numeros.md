# LOG — Auto-instâncias aquecidas + UI bloqueio/substituição

**Contexto:** API Alternativa deve ingressar automaticamente a instância mais aquecida quando faltar número; remover botão «+ Instâncias»; na tela Meus números, bloqueado em vermelho (✕) e substituto em verde (↻).

## Backend

- `resolveAutoInstancesForCampaign`: ordena candidatos por `warmthLevel` (maior primeiro); ignora ativações `blocked`.
- `tryAutoReplenishCampaignInstances`: no tick de disparo e ao ativar campanha — substitui desconectado ou completa mínimo 4; marca ativação bloqueada e registra substituto.
- Campanhas `paused` por saúde tentam auto-replenish e retomam `running` se saúde ok.
- `AlternativaNumberActivation`: campos `status`, `blockedAt`, `replacedByInstanceName`, `replacesInstanceName`.

## Frontend

- Removido botão/handler «+ Instâncias».
- Cards fazenda: `.is-blocked` (vermelho, ✕), `.is-replacement` (verde, ↻).
- Alertas de campanha: texto de ingresso automático (amarelo).

## Validar

1. V02 → campanha com &lt;4 conectados: sistema adiciona números sem botão manual.
2. Meus números: após substituição simulada, bloqueado vermelho + novo verde.
3. Ctrl+F5 após `npm run build`.

**Palavras-chave:** `tryAutoReplenishCampaignInstances`, `warmthLevel`, `auto-replacement`, `+ Instâncias` removido
