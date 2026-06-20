# LOG — Ícone atraso persiste até finalizar

**Data:** 2026-06-12  
**Projeto:** Waba

## Solicitação
Ícone de atraso (SLA 6h) só deve sumir quando a campanha for **finalizada** (`completed`). Enquanto estiver aberta (mesmo `in_progress` após atraso), o ícone permanece. Campanhas finalizadas nunca exibem o ícone.

## Alterações
- `src/admin/waba-operacional-campanhas.service.ts` — `isCampaignStartOverdue`:
  - `generated` + prazo expirado → true
  - `in_progress` + `startedAt` após prazo → true (início tardio)
  - `completed` / `cancelled` → false
- `index.html` — `renderAdminCampanhasOverdueCell` ignora campanhas finalizadas

## Comandos
- `npm run build`

## Validação manual
1. Campanha `generated` com +6h → ícone visível
2. Iniciar campanha (ainda em aberto) → ícone **permanece** se iniciou após o prazo
3. Finalizar campanha → ícone **some** e não volta na aba Finalizadas/Todos
