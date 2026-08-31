# LOG: Embedded Signup — evitar 502 HTML do EasyPanel

## Contexto

No ambiente com EasyPanel/Traefik, erros de `exchange-code` apareciam como página HTML "Service is not reachable" quando o backend retornava status 502.

## Causa raiz

O handler de troca de código devolvia `502` ao cliente em falhas da Meta. O middleware de erro do proxy substitui 502 por página HTML, escondendo o JSON de erro.

## Solução implementada

1. Ajustado `metaEmbeddedSignupExchangeCodeHandler` em `src/index.ts`.
2. Quando a Meta retorna erro:
   - repassa **4xx** para o cliente;
   - usa **424** para falha upstream não-4xx.
3. Quando não há `access_token`, retorna **424**.
4. Build atualizado com `npm run build` (`dist/index.js`).

## Arquivos alterados

- `src/index.ts`
- `dist/index.js`

## Como validar

```bash
curl -i -X POST "https://waba.draxsistemas.com.br/api/meta/embedded-signup/exchange-code" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "code=x"
```

Esperado: resposta JSON de erro de aplicação (ex.: 400/401/424), sem página HTML padrão do EasyPanel.

## Segurança

Nenhum segredo exposto; ajuste apenas de status HTTP e payload de erro.

## Palavras-chave

`exchange-code`, `502`, `easypanel`, `traefik`, `bad-gateway-error-page`, `424`
