# LOG — V01 UI Disparador EVO (não wizard SaaS)

**Data:** 2026-06-19  
**Problema:** V01 mostrava wizard comercial (Nome/DDD/Imagem/Textos/Leads + saldos API Oficial/Alternativa) em vez do Disparador EVO legado.

## Correção

- Oculto no baseline: toolbar assinante, resumo SaaS, wizard `dis-campaign-wizard`
- Restaurado: resumo EVO (enviados/fila/instâncias), seções 1–7 (instâncias → campanha Excel), lista `/disparos/campanhas`
- `loadDisparosEvoCampaigns()` — loader legado; `shouldUseCampanhasSubscriberUi()` desligado no baseline

## Validar

V01 → API não oficial → Disparos: picker de instâncias, temporizador, campanha com planilha, botão Ativar campanha.
