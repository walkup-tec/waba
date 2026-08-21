# LOG — Proxy Brasil obrigatória na campanha Alternativa

## Contexto

Números selecionados na campanha (`1261`, `6973`) ficavam sem Proxy: o prepare liberava envio em sessão `open` sem `proxy/set`.

## Solução

- Seleção/criação/ativação/disparo: aplica Proxy Brasil e só marca ready se `/proxy/find` = enabled.
- Se a sessão cair ao ligar: Proxy permanece on; pede QR com Proxy Campanha.
- Fim da campanha (`finished`) ou exclusão: desliga Proxy, salvo se outra campanha `running`/`paused` ainda usa o número.

## Marker

`DEPLOY-2026-08-11-campanha-proxy-obrigatoria`

## Palavras-chave

Proxy Brasil, campanha Alternativa, proxy/set, finished
