# LOG — Digitar Device Cloud: teclas laterais falhavam

## Sintoma

Campo `51982006034` + Digitar → WhatsApp mostrou `5820-00-4`.

## Causa

Não é separação de DDD. O código envia os 11 dígitos. Toques em X=120 e X=600 (colunas 1/4/7 e 3/6/9) caíam fora do hitbox. Só a coluna do meio (2, 5, 8, 0) registrava: `5 8 2 0 0 0 4`.

## Correção

Coordenadas internas 180/360/540 e intervalo 280 ms.

## Palavras-chave

`Digitar`, `dialpad`, `DDD`, `51982006034`, `virt-tap`
