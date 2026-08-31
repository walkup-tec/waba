# LOG — 2026-08-24 — Alternativa: contact/save em background antes do envio

## Contexto do pedido

Para cada lead da campanha Alternativa: gerar nome aleatório → `contact/save` na instância EVO → depois o envio (`sendButtons`). Falha no save não pode barrar o disparo nem atrasá-lo.

## Ações executadas

- Save disparado em `void` (não `await`) imediatamente antes do “digitando…”.
- Timeout 2s, sem retry; 404 tenta path alternativo.
- `npx tsc` ok.

## Solução implementada

- Nome: prenome + 1 ou 2 sobrenomes brasileiros, sorteados.
- Payload: `{ number, name, saveOnDevice: true }`.
- URLs: `/contact/save/{instancia}` e, se 404/405, `/chat/saveContact/{instancia}`.
- O tempo de “digitando…” (1,8–8 s) corre em paralelo com o save, sem espera extra.

## Arquivos criados/alterados

- `src/index.ts`
- `dist/index.js` (gerado)

## Como validar

- Campanha Alternativa: logs sem `contact/save` bloqueando o send.
- Se a EVO 2.4.0-rc2 tiver o endpoint: contato aparece na agenda da instância com nome fictício.
- Se 404: warn no log e envio segue.

## Observações de segurança

Sem credenciais. Falha de save não altera status do lead.

## Palavras-chave

`contact/save`, agenda WhatsApp, Evolution, fire-and-forget, sendButtons, nome aleatório
