# Disparador — etiquetas de instância com nome do Waba (não canônico EVO)

## Contexto

Na lista de campanhas (`GET /disparos/campanhas`), as etiquetas (`disparadorInstances`) passavam a exibir o nome resolvido da EVO (`canonicalName`). O pedido foi usar **nomes configurados no nosso sistema** (arquivos de mapa), não o identificador técnico/canônico vindo da Evolution.

## Solução

- Tipo `EvoInstanceTagRow`: `canonicalName` → `instanceKey` (só identificação + chave dos mapas) + `displayName` (rótulo para a UI).
- `fetchEvoInstanceTagRows` carrega em paralelo `loadWhatsappProfileNamesMap()` e `loadInstanceAliasesMap()` antes de montar as linhas.
- `displayNameForDisparadorTag`: ordem **nome de perfil WhatsApp salvo** (`WHATSAPP_PROFILE_NAMES_FILE`) → **alias** (`INSTANCE_ALIASES_FILE`) → fallback `instanceKey` (lookup case-insensitive na chave).
- `resolveStoredNameToEvoTag` passa a devolver `r.displayName` em vez do nome canônico da EVO.

A EVO continua sendo usada apenas para **casar** snapshot (nome/dígitos) com a instância atual e o **status** conectado.

## Arquivos alterados

- `src/index.ts` — helpers `mapGetInsensitive`, `displayNameForDisparadorTag`; refator de `buildEvoInstanceTagRowsFromList` e `fetchEvoInstanceTagRows`; ajustes em `resolveStoredNameToEvoTag`.

## Como validar

- `npm run build`
- Com campanha usando instâncias selecionadas: conferir chips na lista; com entrada nos mapas locais, o rótulo deve coincidir com o configurado no Waba; sem mapa, permanece a chave técnica da instância.

## Segurança

- Nenhum segredo alterado; apenas leitura dos mesmos JSON já usados em `GET /instancias`.

## Palavras-chave

`disparadorInstances`, `EvoInstanceTagRow`, `loadWhatsappProfileNamesMap`, `loadInstanceAliasesMap`, `displayNameForDisparadorTag`, etiquetas-campanha
