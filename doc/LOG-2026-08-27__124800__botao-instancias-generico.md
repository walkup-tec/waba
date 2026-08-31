# Botão + Instâncias genérico (qualquer número ativo fora da campanha)

## Contexto do pedido

O botão não deve ser específico do 2102. Qualquer instância ativa que ainda não está na campanha deve entrar ao clicar em **+ Instâncias**, como antes.

## Causa

Com os chips da campanha verdes, o POST recusava inclusão (`instancesToAdd <= 0`). O botão em execução sumia se já havia reserva. O fluxo recente só tentava o `walkup`/2102.

## Solução

- Clique inclui a primeira instância Evolution **conectada** que não está nesta campanha (nem em outra aberta)
- Não exige chip vermelho nem número específico
- Botão visível quando existe reserva conectada, inclusive com campanha rodando
- Grava na hora; Proxy em fila
- Marker: `DEPLOY-2026-08-27-botao-instancias-generico`

## Arquivos

- `src/index.ts`, `src/deploy-marker.ts`
- `index.html`, `dist/index.html`
- `dist/index.js`, `dist/deploy-marker.js`

## Como validar

- Redeploy EasyPanel `waba_disparador`
- `GET /health` = `DEPLOY-2026-08-27-botao-instancias-generico`
- Campanha com chips verdes + um número `open` fora da seleção: **+ Instâncias** traz esse número
- Sem `sendText` de diagnóstico

## Segurança

Sem probe WhatsApp.

## Palavras-chave

+ Instâncias, spare, genérico, campanha, walkup, 2102
