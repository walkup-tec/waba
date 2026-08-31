# Log: Disparador — expediente (seg–sex 8h–22h) no tick de campanhas

## Contexto

No ambiente de produção (porta 3000), campanha em execução com expediente **segunda a sexta, 8h–22h**. Esperativa: fora dessa janela (fim de semana ou após 22h / antes de 8h em horário de Brasília) **não enviar**.

## Diagnóstico

- A função `isDisparosWindowOpen(config, now)` já existia e usa `workingDays`, `startHour`, `endHour` (padrão: seg–sex, 8–22).
- Ela era usada em **`GET /disparos/diagnostico`** com `nowInSaoPaulo()` e `loadDisparosConfigFromDb()`.
- **`runCampaignDispatchTick`** chamava `processOneCampaignDispatch` para todas as campanhas `running` **sem** checar expediente — envios podiam ocorrer 24h.

## Solução

Em `runCampaignDispatchTick`:

1. Calcular `nowSp = nowInSaoPaulo()` uma vez por tick (alinhado ao aquecedor/diagnóstico).
2. Para cada campanha em execução, avaliar `isDisparosWindowOpen(c.configSnapshot || DISPAROS_DEFAULTS, nowSp)`.
3. Se `!janela.aberta`, **não** chamar `processOneCampaignDispatch` naquele tick (campanha permanece `running`; apenas pausa envios até a próxima janela).

Cada campanha respeita o **snapshot** salvo na criação (`configSnapshot`), não só a config global atual.

## Regras de horário (comportamento existente em `isDisparosWindowOpen`)

- Dia atual (fuso implícito no `Date` passado — aqui `nowInSaoPaulo`) deve estar em `workingDays` (códigos `seg`…`sab`/`dom`).
- Hora inteira: envia se `startHour <= hora < endHour` (ex.: 8–22 → válido 8h00–21h59; a partir de 22h00 para).

## Arquivos

- `src/index.ts`
- `doc/LOG-2026-03-27__193000__disparo-respeitar-expediente-config-snapshot.md`

## Como validar

1. `GET /disparos/diagnostico` — campo `janela` deve refletir config global; com campanha `running`, fora da janela o tick não deve consumir leads.
2. Simular fora do expediente (ou aguardar): leads `pending` não devem mudar para `sent` até entrar na janela.

## Palavras-chave

`runCampaignDispatchTick`, `isDisparosWindowOpen`, `configSnapshot`, expediente disparador, `nowInSaoPaulo`
