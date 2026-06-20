# Wizard campanha — link de resposta + plano na etapa Leads

**Data:** 2026-06-12

## Etapa Textos
- Campo **Link de resposta do envio** (obrigatório, http/https)
- Persistido em `WabaCampaignIntake.responseLink`
- Exibido no modal operacional (**Link de resposta**, clicável)

## Etapa Leads
- Seleção de **plano** (API Oficial / API Alternativa) quando há saldo nos dois
- Com saldo em um plano só: seleção automática (UI de plano oculta)
- Quantidade de envios validada por plano escolhido (≤ saldo e ≤ linhas da planilha)
- `apiKind` enviado no POST `/disparos/campanhas/intake`

## Arquivos
- `src/disparos/waba-campaign-intake.repository.ts`
- `src/disparos/waba-campaign-intake.routes.ts`
- `src/admin/waba-operacional-campanhas.service.ts`
- `index.html`

## Validar
Reiniciar `dev:v02` + Ctrl+F5. Criar campanha com link e plano; abrir modal em Campanhas (operacional).
