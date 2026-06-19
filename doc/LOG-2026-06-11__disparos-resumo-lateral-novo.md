# LOG — novo resumo lateral Disparos/Campanhas

**Data:** 2026-06-11  
**Pedido:** substituir resumo + variáveis do lado esquerdo por três métricas.

## UI
- **Enviados** — créditos consumidos (envios finalizados)
- **Em fila** — destinos pendentes em campanhas não finalizadas
- **Ainda disponíveis** — saldo remanescente de créditos

Configuração do disparador movida para bloco abaixo do grid (`Configuração do disparador`).

## JS
- `syncDisparosResumoSide()` — atualiza painel com campanhas + `/billing/disparos/credits`

## Arquivo
- `D:\Waba\index.html`
