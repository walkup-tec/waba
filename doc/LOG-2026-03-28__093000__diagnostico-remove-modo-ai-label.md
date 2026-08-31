# Log: diagnóstico Disparador — remoção do rótulo «modo ai»

## Contexto

O aquecedor opera com mensagens **pré-definidas no banco**, não com IA. A inscrição **«modo ai»** no diagnóstico gerava confusão com o fluxo do aquecedor.

## Solução

- Removidos do `GET /disparos/diagnostico`: `configResumo.messageMode`, `messageModeLabel`, e por campanha `modoMensagem` / `modoMensagemLabel`.
- Removida a função `describeDisparosMessageMode` (só usada nesse diagnóstico).
- UI do log de diagnóstico: sem trecho «modo …» na linha de config nem na linha por campanha.
- Linha **Templates ativos (memória): N** passa a ser sempre exibida (não condicionada a `messageMode`).

A configuração interna `messageMode` no `DisparosConfig` e na UI de criação de campanha permanece para quem usa disparo com templates vs. fluxo alternativo; apenas o **texto do diagnóstico** deixa de citar «modo ai».

## Arquivos

- `src/index.ts`, `index.html`

## Palavras-chave

`disparos/diagnostico`, remover modo ai, templates memória
