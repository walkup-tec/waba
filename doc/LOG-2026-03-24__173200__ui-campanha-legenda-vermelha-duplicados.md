# UI: legenda vermelha — telefones duplicados excluídos (campanha)

## Pedido

Ao importar lista para disparo, mostrar em **legenda vermelha** o total de telefones **duplicados/excluídos**.

## Implementação

- Elemento `#dis-campaign-dedupe-caption` abaixo da área de campanha, estilo `.dis-campaign-dedupe-caption` (texto vermelho).
- `normalizeCampaignPhoneForDisparo` + `countCampaignPhoneDuplicatesInRows` alinhados à lógica do servidor (≥12 dígitos, normalização BR).
- Ao abrir o modal de mapeamento: ao escolher a coluna do número, atualiza a legenda com a contagem local.
- Ao confirmar criação: legenda antes do POST (estimativa) e após sucesso com `duplicatesRemoved` do servidor.
- Limpeza: nova importação de arquivo, erro de leitura, falha no POST, fechar/cancelar modal (mantém legenda ao fechar após sucesso: `closeDisCampaignMappingModal(false)`).
- Texto de sucesso verde (`dis-campaign-create-status`) deixa de repetir duplicatas (fica só na legenda vermelha).

## Arquivos

- `index.html` → `dist/index.html`
