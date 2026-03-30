# Disparador — «Números disponíveis» respeita uso nos disparos

## Contexto

Instâncias com **Disparador** desmarcado na tabela de instâncias continuavam em **Números disponíveis** na Seção 1 do disparador.

## Causa

`syncDisparadorNumberPicker()` montava candidatos só com **conectado** (`open`), sem consultar `instanceUsageByName` / `getInstanceUsage().useDisparador`. Além disso, após salvar `/instancias/uso-config` o picker não era atualizado.

## Solução

- Filtro: `getInstanceUsage(row.name).useDisparador` (falsy exclui; ausência na API continua default **permitido**, como no restante da UI).
- Após `POST` de uso com sucesso em `saveInstanceUsageConfig`, chamar `syncDisparadorNumberPicker()`.

## Arquivo

- `index.html`

## Validar

- Desmarcar **Disparador** em uma instância: ela some das duas listas (disponíveis/selecionadas) após salvar; marcar de volta e ela volta em disponíveis se estiver `open`.

## Palavras-chave

`syncDisparadorNumberPicker`, `useDisparador`, `dis-available-instances`, `instancias/uso-config`
