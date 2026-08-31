# UX: legenda de duplicatas visível + 4s antes de gravar campanha

## Pedido

Legenda de duplicatas não aparecia após mapear (overlay/modal cobria o painel). Fluxo desejado: ver resumo **antes** do reset; **4s** com alerta “Criando campanha”; **depois** POST + reset + lista à direita.

## Implementação

1. Fechar modal de mapeamento **sem** limpar legenda (`closeDisCampaignMappingModal(false)`), aplicar `setDisCampaignDedupeCaption(localDup)` e `scrollIntoView` em `#dis-campaign-dedupe-caption`.
2. Legenda sempre visível após confirmar: **vermelho** se há duplicados; **verde** (`dis-campaign-dedupe-ok`) se zero duplicados.
3. Toast **info** “Criando campanha… Aguarde alguns segundos.” por **4s** + `await` 4s; em seguida overlay de trabalho + `POST /disparos/campanhas`.
4. `configSnapshot` congelado em string antes do delay (evita mudança do formulário durante a espera).
5. Em erro de POST, legenda **não** é apagada (só toast de erro).
6. CSS `.toast.info` para o alerta de criação.

## Arquivos

- `index.html` → `dist/index.html`
