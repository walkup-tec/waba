# Botão + Instâncias não incluía o spare

## Contexto

Marker `083300` já no Docker. Corbans: WB-7770 vermelho, texto de spare, clique em «+ Instâncias» sem chip novo.

## Causa

GET conta spare por apelido (`WB-2102` etc.). POST exigia `connectionState=open` e, se falhasse, `409 buy_numbers_required` mandava a UI para comprar números. Persistência ainda fazia troca 1:1.

## Solução

- POST auto usa a **mesma lista** do GET; se houver nome, inclui.
- Inclusão é **append** (não remove o 7770).
- 409 não redireciona mais para compra.

## Marker

`DEPLOY-2026-08-28-090000-botao-append-spare`

## Palavras-chave

+ Instâncias, spare, buy_numbers_required, append, WB-7770
