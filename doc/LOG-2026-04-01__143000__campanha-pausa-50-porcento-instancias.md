# Campanha — pausa ao atingir 50% de instâncias desconectadas

## Contexto

Ajuste solicitado: a campanha deve pausar quando **metade ou mais** das instâncias selecionadas estiverem desconectadas (50% inclusive), e não apenas quando **mais de** 50% estiverem desconectadas.

## Ações executadas

- Alterado o critério de `disconnectedCount / selectedCount > 0.5` para `>= 0.5` em:
  - `getCampaignInstanceHealth` (cálculo central usado na pausa automática no tick e no bloqueio de ativação).
  - Cálculo duplicado na listagem `GET /disparos/campanhas` (mantém `instanceHealth` alinhado ao backend).
- Mensagem de `409` em `POST /disparos/campanhas/:id/estado` atualizada para refletir “50% ou mais”.
- `npm run build` para atualizar `dist/`.

## Arquivos alterados

- `src/index.ts`
- `dist/index.js` (via build)
- `doc/memoria.md`
- `doc/LOG-2026-04-01__143000__campanha-pausa-50-porcento-instancias.md` (este arquivo)

## Como validar

- Campanha com **2 instâncias** no snapshot: com **1 desconectada**, deve disparar pausa/bloqueio (50%).
- Campanha com **4 instâncias**: com **2 desconectadas**, mesmo comportamento.
- `GET /disparos/campanhas`: `instanceHealth.shouldPauseByDisconnectedRatio` deve ser `true` nesses casos.

## Segurança

- Nenhum segredo alterado; apenas regra de negócio e texto de erro.

## Palavras-chave (busca futura)

`campanha-pausa-instancias`, `shouldPauseByDisconnectedRatio`, `50-porcento-desconectadas`, `>= 0.5`
