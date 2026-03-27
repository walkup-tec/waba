## Contexto do pedido

Corrigir indicador de conversão do relatório quando aparece:
- mais cliques do que envios
- valor não bater com cliques reais feitos no link durante teste

## Causa provável

O EncurtadorPro pode reutilizar shortUrl quando o `longUrl` é idêntico entre execuções/campanhas.
Isso faz com que cliques antigos se misturem com os cliques atuais.

## Ações executadas

1. Geração de `longUrl` único por lead usando nonce em:
   - `composeOutboundMessageForConfig` (mensagens de campanha)
   - endpoint de teste `/disparos/gerar-mensagem-ai`
2. Mantido o cálculo de cliques no relatório com:
   - parser corrigido para `data.clicks`
   - conversão = (total cliques) / (enviados com sucesso)

## Arquivos alterados

- `src/index.ts`
- `doc/LOG-2026-03-26__174447__shortener-nonce-anti-reuse.md`
- `doc/memoria.md`

## Como validar

1. Reiniciar o servidor (`npm start`) para usar o `dist/`.
2. Rodar um disparo pequeno.
3. Fazer cliques no link retornado.
4. Abrir `Relatório` e conferir se:
   - cliques refletem apenas o teste recente
   - conversão não fica inflada por histórico

## Segurança

- Sem logar chaves/tokens.

## Palavras-chave

- encurtadorpro
- shortUrl-reuse
- anti-reuse-nonce
- relatorio-conversao
