# LOG — Campanha Alternativa: remover `**` antes do texto

## Contexto

No motor de envio da API Alternativa, o WhatsApp digitava `**` antes de começar o texto da campanha.

## Causa raiz

Evolution 2.4 `buttonMessage` monta o corpo como `*${title}*`. O WABA enviava `title` ZWSP (`\u200b`) para evitar cabeçalho em negrito. Markdown vazio vira `**` visível na digitação.

## Solução

`title` passa a ser a primeira linha/palavras reais do texto (sem ZWSP e sem `*` extras). O restante vai em `description`. A Evolution continua envolvendo o title em `*...*`; com letras reais o WhatsApp trata como negrito, não como `**` literal.

## Arquivos

- `src/index.ts` (`visibleEvoButtonTitle`, `splitMessageForUrlButton`)
- `src/deploy-marker.ts`
- `dist/index.js`
- `dist/deploy-marker.js`

## Como validar

Após Redeploy EasyPanel `waba_disparador`: disparo Alternativa não deve começar digitando `**`. Marker `DEPLOY-2026-08-24-alternativa-sem-asteriscos-titulo`. Sem `sendText` de teste extra.

## Palavras-chave

sendButtons, title ZWSP, asteriscos, API Alternativa, buttonMessage
