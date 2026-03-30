# Disparador — etiquetas iguais a «Nome da Instância» + match por nome salvo/perfil

## Contexto

As etiquetas na lista de campanhas ainda mostravam códigos curtos (ex.: `1267`, `1311`) ou nomes técnicos, enquanto a tabela de instâncias exibia **SOMA - XXXX** (coluna **Nome da Instância**).

## Causa

1. O `displayName` da lista vem de **GET /instancias**: `whatsappNameOverride || profileName || instanceKey` (com `profileName` vindo do payload da EVO na listagem). As etiquetas tinham deixado de usar `profileName`.
2. `nameKeys` usado para casar o **snapshot** da campanha só incluía campos técnicos da EVO, **não** `profileName` nem os textos salvos em `whatsapp-profile-names.json` / `instance-aliases.json`. Assim, um valor guardado como «SOMA - 8927» não batia com nenhuma linha e o fluxo caía no **match por dígitos**, podendo escolher instância errada (ex.: trecho `1267`).

## Solução

- `displayNameForDisparadorTag(instanceKey, inst, whatsappMap)`: igual ao item base de `/instancias` — override em arquivo → `inst.profileName` → `instanceKey`.
- `nameKeys`: acrescentados `profileName`, valor do mapa WhatsApp e valor do alias (todos normalizados em minúsculas) para o `instanceKey` da linha.
- `pickBestDigitHitRow`: quando há **várias** instâncias no hit por dígitos, pontua candidatos que contêm a **sequência numérica mais longa** do snapshot ou o texto completo em `displayName`/`instanceKey`, e desempata com `connected`.

## Arquivos

- `src/index.ts` — `addComparableNameKey`, ajustes em `buildEvoInstanceTagRowsFromList`, `resolveStoredNameToEvoTag`, `pickBestDigitHitRow`.

## Validar

- `npm run build`
- Campanhas com instâncias já nomeadas na lista: chips devem repetir o mesmo texto da coluna **Nome da Instância** (salvo diferença por sync live na tela de instâncias).

## Palavras-chave

`disparadorInstances`, `nameKeys`, `profileName`, `pickBestDigitHitRow`, nome-instancia
