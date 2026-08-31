# LOG — fix botão Gerar Campanha sem resposta

**Data:** 2026-06-08  
**Solicitação:** usuário clicou em «Gerar Campanha» e nada aconteceu.

## Causa provável
1. Validação do passo 5 (planilha Excel obrigatória) falhava só com toast discreto no canto — parecia «nada aconteceu».
2. `initDisCampaignWizard()` rodava só no final do boot pós-login; qualquer erro antes (ex.: `getElementById("time-filters")`) impedia registrar o clique no botão.

## Alterações
- `index.html`: mensagem de erro inline abaixo do wizard + shake no nav; validação de **todos** os passos no envio; scroll para sucesso; toast de sucesso; `initDisCampaignWizard()` no boot imediato (com guard anti-duplo bind); listeners de filtro com `?.`.
- `src/deploy-marker.ts`: `DEPLOY-2026-06-08-fix-wizard-gerar-campanha-v1`

## Validar
1. Ctrl+F5 em `http://localhost:3012/version-02/`
2. Campanhas → wizard até passo 5
3. Sem Excel: deve aparecer aviso amarelo abaixo dos botões
4. Com imagem 1080×1080 + Excel: painel «Solicitação enviada» + campanha na lista à esquerda

## Pendências
- Reiniciar `npm run dev:v02` se quiser ver novo `deployMarker` no `/health`.
