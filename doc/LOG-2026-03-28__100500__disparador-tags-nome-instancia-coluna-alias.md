# Disparador — etiquetas usam «Nome da Instância» (alias), não Nome (WhatsApp)

## Contexto

Etiquetas mostravam `1311` em vez de `SOMA - 1311` e aparecia **Soma Promotora** sem existir na lista com esse nome de instância.

## Causa

Na tabela de instâncias (`index.html`), as colunas são distintas:

- **Nome (WhatsApp)** → `displayName` = override arquivo + `profileName` da EVO.
- **Nome da Instância** → `instanceLabel` = **`instanceAlias || instanceName`** (alias em `data/instance-aliases.json` + chave técnica).

O backend das etiquetas usava a lógica do **WhatsApp** (`profileName`), gerando rótulos numéricos e nomes de **perfil comercial** de instância errada no match por dígitos.

## Solução

- `EvoInstanceTagRow.displayName` passa a ser **`mapGetInsensitive(aliasesMap, instanceKey) || instanceKey`**, alinhado ao front (`instanceNomeInstanciaForDisparadorTag`).
- `nameKeys` mantém perfil + nomes WhatsApp + alias para **casar** o snapshot da campanha com a linha certa; só o **texto do chip** usa alias || chave.

## Arquivo

- `src/index.ts`

## Validar

- `npm run build`; reiniciar `start:prod`.
- Chips devem repetir exatamente a coluna **Nome da Instância** (ex.: SOMA - 1311).

## Palavras-chave

`instanceLabel`, `instanceAlias`, `instance-aliases.json`, `disparadorInstances`, nome-instancia
