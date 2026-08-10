# LOG — Leads: Excel/TXT + mínimo 1000 envios

## Contexto do pedido

Na etapa Leads da campanha API Oficial:
1. Bloquear qualquer arquivo que não seja Excel ou TXT e informar os formatos aceitos.
2. Impedir geração de campanha com menos de 1000 envios.

## Solução implementada

### Upload de leads
- Aceitos: `.xlsx`, `.xls`, `.txt` (TXT = um contato por linha; linhas vazias ignoradas).
- UI: texto “Formatos aceitos: Excel (.xlsx, .xls) ou TXT (.txt). Outros formatos serão bloqueados.”
- Frontend rejeita e limpa input inválido; backend valida extensão.

### Mínimo de envios
- Constante `WABA_CAMPAIGN_MIN_PLANNED_SEND_COUNT = 1000`.
- Validação no wizard (UI + `getDisCampaignWizardStepError`) e no `resolvePlannedSendCount` / leitura do arquivo no backend.
- Input de quantidade com `min="1000"` e hint com o mínimo.

## Arquivos alterados

- `index.html` / `dist/index.html`
- `src/disparos/waba-campaign-spreadsheet.util.ts`
- `src/disparos/waba-campaign-intake.constants.ts`
- `src/disparos/waba-campaign-intake.routes.ts`
- `src/admin/waba-operacional-campanhas.service.ts`
- `src/admin/waba-operacional-campanhas.routes.ts`
- `dist/` correspondente

## Como validar

1. Etapa Leads: tentar CSV/PDF → bloqueado com aviso de formatos.
2. Enviar `.txt` com contatos (1 por linha) → importa e conta linhas.
3. Quantidade &lt; 1000 → não gera campanha (UI e API).
4. Arquivo com &lt; 1000 contatos → erro de mínimo.

## Observações

- TXT tratado como lista linha a linha (não CSV tabular).
- Download operacional de leads respeita `.txt` vs `.xlsx` no Content-Type.

## Palavras-chave

`leads`, `excel`, `txt`, `xlsx`, `xls`, `minimo-1000`, `plannedSendCount`, `wizard`, `api-oficial`
