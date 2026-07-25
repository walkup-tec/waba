# LOG — Print aquecedor: deadlock saldo/anti-duplicata

## Contexto

Usuário enviou print: Motor ativo, 3 instâncias no ciclo, HTTP 502 intermitente no poll, mensagem:

> Aguardando equilíbrio de pares: nenhum envio elegível agora (saldo/anti-duplicata).

## Diagnóstico

Motor **ligado** — não é stop. O ciclo roda e `pickAquecedorCombinationAsync` retorna `null`.

Causa de código: `getPairDirectionAllowed` bloqueava **sempre** repetir `lastDirection`. Com grafo legado/bootstrap (`|saldo|=1` e `lastDirection` já no sentido curativo), **as duas direções ficavam proibidas** → zero candidatos → loop eterno a cada ~30s com essa mensagem.

Isso explica 0 envios após 16:55 com motor “ativo”.

HTTP 502 no status: publish/Traefik intermitente (heal `:30180`); aparte do deadlock.

## Correção

- Exceção: permitir repetir sentido **só se reduzir** `|saldo|`.
- Mensagem de status inclui contagem de cooldowns de entrega quando houver.
- Marker: `DEPLOY-2026-07-25-aquecedor-pair-deadlock-unlock`
- Teste: `scripts/test-aquecedor-pair-deadlock.cjs`

## Validar

1. Push + Redeploy Node
2. `/health` com o marker novo
3. Status deixa de ficar só em “nenhum envio elegível” e volta a gerar `ENVIADO` entre as 3 instâncias healthy

## Palavras-chave

aquecedor deadlock, saldo, anti-duplicata, lastDirection, getPairDirectionAllowed, nenhum envio elegível
