# Log: etiquetas de campanha — nome atual da EVO (resolver snapshot)

## Contexto

Etiquetas na lista de campanhas mostravam nomes **gravados no snapshot** (`selectedDisparadorInstances`), desatualizados após renomear instâncias na Evolution.

## Solução

1. **`EvoInstanceTagRow`**: para cada instância na resposta da EVO, guarda `canonicalName` (mesma prioridade que `GET /instancias`: `instanceName` → `name` → `id` → …), `connected`, `nameKeys` (variantes em minúsculas) e `digitKeys` (`buildComparableOwnerDigits` do número dono).

2. **`resolveStoredNameToEvoTag`**: para cada nome do snapshot:
   - tenta **match por nome** (qualquer variante);
   - senão **match por dígitos** extraídos do rótulo antigo (ex.: `SOMA - 6019`, `1267`) contra o número da instância na EVO;
   - empate por dígitos: prefere instância **conectada**.

3. **`disparadorInstanceTagsForCampaign`**: devolve `instanceName` = **nome canônico atual** da EVO; deduplica por display (case-insensitive) e ordena em `pt-BR`.

4. **`fetchEvoInstanceTagRows`** substitui o mapa booleano usado só na listagem de campanhas.

## Arquivos

- `src/index.ts`

## Palavras-chave

`EvoInstanceTagRow`, `resolveStoredNameToEvoTag`, etiquetas campanha, snapshot instâncias
