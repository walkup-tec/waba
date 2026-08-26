# LOG — Alternativa: quebra de linha real + rótulo do botão sem corte

## Contexto do pedido

Na mensagem Alternativa, `\n` aparecia como texto de programação (duas letras) em vez de linha nova. Itens `1) 2) 3)` saíam na mesma linha. Rótulo de 20 caracteres era cortado no botão nativo do WhatsApp (o botão não cresce com o texto).

## Solução

1. `formatWhatsAppVisibleLayout`: transforma `\n` literal em quebra real; se houver dois ou mais `1) 2)` (ou `1. 2.`), cada item vai para a linha de baixo.
2. Rótulo customizado da IA acima de **15** caracteres deixa de ser fatiado no meio — cai no fallback da allowlist (`Quero saber mais`, etc.). Allowlist continua inteira (não corta “Quero saber mais”).
3. Prompt da IA: newline real no JSON; enumeração em linhas; `buttonLabel` máximo 15 caracteres.

## Arquivos

- `src/index.ts` / `dist/index.js`
- `src/deploy-marker.ts` / `dist/deploy-marker.js`
- Marker: `DEPLOY-2026-08-26-alternativa-quebra-linha-botao-curto`

## Como validar

Após Redeploy EasyPanel `waba_disparador`:

- `GET /health` com o marker novo
- Mensagem com `1) 2) 3)`: cada item em uma linha, sem `\n` visível
- Botão: texto inteiro, sem reticências no meio do rótulo

## Observações

O botão URL nativo do WhatsApp tem largura fixa no app; não dá para o pill “esticar”. A correção é não enviar rótulos de 20 caracteres.

## Palavras-chave

`\\n`, quebra de linha, `1) 2) 3)`, `buttonLabel`, `sendButtons`, Alternativa
