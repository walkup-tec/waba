# Log: lista de campanhas — etiquetas de instâncias (verde / vermelho)

## Contexto

Na lista do Disparador, exibir as **instâncias vinculadas à campanha** (`config_snapshot.selectedDisparadorInstances`) como **etiquetas**: verde se conectadas na EVO, vermelho se desconectadas ou ausentes na leitura atual.

## Solução (backend)

- `buildEvoInstanceConnectedMapFromList`, `fetchEvoInstanceConnectedMap`, `disparadorInstanceTagsForCampaign` em `src/index.ts`.
- `GET /disparos/campanhas`: uma consulta à EVO por request; `select` passa a incluir `config_snapshot`; cada item inclui `disparadorInstances: [{ instanceName, connected }]`.
- `connected === true` somente quando `connectionStatus` (ou `status`) contém `open`, como em `buildConnectedFromEvoResponse`.

## Solução (frontend)

- CSS `.dis-campaign-instance-tags`, `.dis-campaign-instance-tag--connected` (verde), `--disconnected` (vermelho).
- Renderização em `loadDisparosTemplates`: chips com `title` acessível.
- Campanha **running** sem instâncias no snapshot: aviso curto para revisar Seção 1.

## Observação

O estado é o **instantâneo atual** da EVO ao carregar a lista, não um histórico de “caiu no meio da campanha”; na prática, instância desligada aparece em vermelho até voltar a conectar.

## Palavras-chave

`disparadorInstances`, `config_snapshot`, etiquetas campanha, EVO connectionStatus
