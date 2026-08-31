# Log: UI Campanha — import Excel, loading e prévia

## Contexto
Melhorar o fluxo de importação da planilha na seção **Campanha**: visual mais polido, feedback de processamento e prévia das primeiras linhas após importar.

## Ações executadas
- Estilização da área de upload (dropzone com ícone, hover e arrastar-soltar).
- Overlay em tela cheia (`z-index` acima do modal) com spinner e texto animado durante leitura da planilha e durante criação da campanha.
- Tabela de prévia com até **10 primeiras linhas** e todas as colunas detectadas.
- `npm run build`.

## Implementação
1. **CSS**: classes `dis-campaign-*` (dropzone, preview, overlay de trabalho, spinner, tabela).
2. **HTML**: substituído input cru por dropzone + input invisível; bloco de prévia com tabela; overlay `#dis-campaign-work-overlay`.
3. **JS**:
   - `processDisCampaignFile(file)` — aguarda XLSX, parseia, atualiza meta do arquivo, renderiza prévia, toast de sucesso.
   - `renderDisCampaignPreviewTable(rows)` — amostra de 10 linhas com escape seguro.
   - `setDisCampaignWorkBusy` — controla overlay e mensagens.
   - Arrastar/soltar com validação `.xlsx` / `.xls` e `DataTransfer` no input quando suportado.
   - `openDisCampaignMappingFlow` — reutiliza cache; se vazio, importa do arquivo selecionado.
   - `createCampaignFromMappedSpreadsheet` — overlay durante `POST /disparos/campanhas`.

## Arquivos alterados
- `index.html`

## Como validar
1. Abrir Disparos → **7) Campanha**.
2. Arrastar ou clicar na área tracejada e escolher Excel.
3. Ver overlay “Importando planilha…” e, em seguida, prévia com 10 linhas.
4. Mapear coluna e criar campanha — ver overlay “Registrando campanha…”.

## Palavras-chave
- ui-campanha-dropzone
- preview-planilha-10-linhas
- dis-campaign-work-overlay
