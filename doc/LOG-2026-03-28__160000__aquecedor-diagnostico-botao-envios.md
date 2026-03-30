# Aquecedor — botão Diagnóstico ao lado de Atualizar (painel Envios)

## Contexto

Operador queria ver o diagnóstico do que está sendo aquecido sem ir ao bloco do motor; botão ao lado de **Atualizar** na coluna **Envios**.

## Solução

- HTML: grupo `.aquecedor-envios-actions` com `aquecedor-envios-diagnostico-btn` + refresh.
- JS: `aquecedorRunDiagnosticoAndLog()` reutiliza `GET /aquecedor/diagnostico` e `GET /aquecedor/fila-localizar`, escreve em **Logs de comandos**; inclui linha extra com **próxima combinação** (origem → destino) e lista de instâncias conectadas com aquecedor ativo.
- Botão **Diagnóstico** do painel do motor chama a mesma função.

## Arquivos

- `index.html`

## Palavras-chave

`aquecedor-envios-diagnostico-btn`, `aquecedorRunDiagnosticoAndLog`, diagnóstico-aquecedor
