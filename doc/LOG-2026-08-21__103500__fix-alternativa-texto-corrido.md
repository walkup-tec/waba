# Campanha Alternativa: texto corrido sem título em negrito

## Contexto

Print: primeiras ~60 letras em negrito/separadas (corta “ambiente”); às vezes negrito no meio (`*Quero saber mais*`).

## Causa

Evolution 2.4 `buttonMessage` monta `body = *${title}*\n\n${description}`. O WABA punha o 1º pedaço em `title` (`slice(0,60)`). Markdown da IA virava negrito no corpo.

## Solução

- `title` = ZWSP; texto inteiro em `description` (até 1024, sem cortar palavra).
- `*texto*` da IA permanece (negrito só quando pedido).
- Marker `DEPLOY-2026-08-21-alternativa-body-sem-titulo`

## Validar

Push `master` + Redeploy `waba_disparador`. `/health` com o marker. Próximo envio: um bloco de texto + botão, sem cabeçalho em negrito.

## Palavras-chave

sendButtons, title, description, negrito, ZWSP, API Alternativa
