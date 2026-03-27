## Contexto do pedido

O shortUrl gerado estava ficando igual e o relatório de conversão ficava com valores inconsistentes (cliques acumulados/histórico).

## Ações executadas

1. Ajustei o provider `encurtadorpro` no backend (`src/index.ts`) para, quando não houver `ENCURTADORPRO_CUSTOM_ALIAS` definido:
   - extrair `_n8n_link_nonce` do `longUrl`
   - gerar um `custom` alias derivado do nonce (`n8n<nonceClean>`)
2. Objetivo: forçar o EncurtadorPro a retornar shortUrls isolados por execução/teste, evitando deduplicação.

## Arquivos alterados

- `src/index.ts`
- `doc/LOG-2026-03-26__180328__encurtadorpro-custom-alias-nonce.md`
- `doc/memoria.md`

## Como validar

1. Reiniciar o servidor (`npm start`) para carregar o novo `dist/index.js`.
2. Gerar mensagem teste novamente e verificar se o shortUrl muda.
3. Reabrir o relatório e conferir se conversão bate com os cliques feitos no teste.

## Observações de segurança

- Chave de API continua via variável de ambiente, sem logs.

## Palavras-chave

- encurtadorpro, custom-alias, nonce, anti-dedup
