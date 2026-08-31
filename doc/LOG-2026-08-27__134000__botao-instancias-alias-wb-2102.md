# + Instâncias reconhece WB-2102 por alias e connectionState

## Contexto do pedido

Campanha Corbans pedia «+ Instâncias» para o número livre. `5197462102` está conectado como **WB-2102**, mas o clique não o incluía.

## Causa

O botão comparava só o nome técnico da Evolution (`walkup`) e o `open` do `fetchInstances`. A tela de Instâncias usa alias **WB-2102** e `connectionState` real. O 2102 ficava de fora; o aviso de «número livre» vinha de outro nome técnico.

## Solução

- Identidade da campanha: nome técnico, alias e telefone (≥8 dígitos)
- Reserva com alias (WB-2102) entra na conta mesmo se `fetchInstances` não disser open
- No clique, confirma `connectionState=open` nas reservas e grava
- Marker: `DEPLOY-2026-08-27-botao-instancias-alias`

## Arquivos

- `src/index.ts`, `src/deploy-marker.ts`
- `dist/index.js`, `dist/deploy-marker.js`

## Como validar

- Redeploy `waba_disparador`
- `/health` = `DEPLOY-2026-08-27-botao-instancias-alias`
- Corbans: **+ Instâncias** → pílula **WB-2102**
- Sem `sendText`

## Palavras-chave

+ Instâncias, WB-2102, walkup, alias, 5197462102, Corbans
