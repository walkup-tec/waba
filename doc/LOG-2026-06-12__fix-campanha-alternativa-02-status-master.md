# LOG — Campanha Alternativa 02 status master

**Data:** 2026-06-12

## Sintoma
Master via "Aguardando configuração" em `Campanha API ALternativa 02` (`d33c148c-…`) após operador supostamente finalizar.

## Causa raiz
1. No JSON `waba-campaign-intakes.json` o status estava `generated` (nunca persistiu finalização).
2. `digitalcorban@gmail.com` é operacional **API Oficial** (`operacionalDispatchesApi: oficial`) — backend bloqueia campanhas `apiKind: alternativa` com *"Campanha não disponível para o seu tipo de operação."*
3. Operador correto para Alternativa: `somaconecta@gmail.com`.

## Correções
- `saveCampaignReport`: mensagem clara se campanha não foi iniciada.
- Front: atualiza `adminCampanhasCache` com `payload.campaign` antes do reload; troca aba Finalizadas só após `loadAdminCampanhas()`.
- Dados: campanha finalizada via `somaconecta` (300 enviados, relatório gravado, status `completed`).

## Validação
Master F5 → Campanhas → aba Finalizadas → status **Finalizado**.
