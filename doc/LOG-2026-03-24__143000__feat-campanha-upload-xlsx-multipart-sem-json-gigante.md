# LOG: campanha — upload Excel multipart (fim do PayloadTooLarge por JSON)

## Problema

Listas enormes de telefones em `JSON.stringify({ numbers: [...] })` geravam corpos de requisição gigantes e `PayloadTooLargeError`, além de custo de parse/memória.

## Solução

- **Frontend**: `POST /disparos/campanhas` com `FormData`: `name`, `numberColumn`, `configSnapshot` (string JSON), `spreadsheet` (arquivo).
- **Backend**: `multer` (memória) + `xlsx` para ler a primeira aba e a coluna escolhida; mesma regra de normalização de números.
- **Legado**: mesmo endpoint ainda aceita `application/json` com `numbers[]` (APIs/scripts pequenos).
- **Env**: `CAMPAIGN_UPLOAD_MAX_MB` (padrão 100). CSV do limite no log na subida.

## Dependências

- `multer`, `xlsx`; dev `@types/multer`.

## Validar

1. Reiniciar servidor após `npm run build`.
2. Criar campanha pela UI; tráfego não deve carregar a lista inteira no JSON.

## Palavras-chave

`multipart`, `multer`, `xlsx`, `PayloadTooLarge`, `disparos/campanhas`
