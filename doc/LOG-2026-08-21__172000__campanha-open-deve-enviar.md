# LOG — Campanha dispara quando a Evolution está open

## Contexto

A campanha Seguradoras ficou pausada com prejuízo: o WABA mostrava 0 de 2 conectados enquanto `9224` e `drax` estavam `open` na Evolution. Cache/lista de instâncias vazia e a regra de 50% offline pausavam mesmo com número ativo.

## Solução

1. Confirmar `connectionState` dos nomes selecionados da campanha, mesmo se `fetchInstances`/cache vier vazio.
2. Não tratar probe falho como desconectado.
3. Pausar automaticamente só se o mínimo de `open` (1) não estiver confirmado.
4. Retomar sozinha pausa automática de saúde quando o mínimo voltar.
5. Pick de envio escolhe instância pelo live `open`, não por match exato da lista.

## Como validar

- Com `9224`/`drax` `open` na Evolution, `/disparos/campanhas` não deve listá-los como 0 conectados.
- Campanha pausada só por saúde deve voltar a `running` no tick e enviar.

## Palavras-chave

campanha, pause, connectionState, fetchInstances, Seguradoras, 50% offline
