# Log: diagnóstico Disparador — expediente, previsão e modo de mensagem

## Contexto

1. Linha de campanha no diagnóstico dizia «elegível no próximo ciclo» mesmo **fora do expediente**; faltava **previsão de retorno** conforme `workingDays` / `startHour` / `endHour` do snapshot da campanha.
2. Dúvida sobre o texto **«modo ai»**.

## Solução (backend)

- Funções `findNextDisparosWindowStart` e `describeDisparosMessageMode` em `src/index.ts`.
- `GET /disparos/diagnostico`:
  - `janela` passa a incluir `previsaoRetornoBr` quando a janela global está fechada.
  - `configResumo.messageModeLabel`: descrição curta do modo.
  - Cada item em `campanhas.emExecucao`: `proximoEnvio` distingue **fora do expediente** (com previsão) vs **dentro** (intervalo entre envios vs próximo ciclo); campos `janelaExpedienteAberta`, `janelaExpedienteMotivo`, `previsaoRetornoExpedienteBr`, `modoMensagemLabel`.

## Significado dos modos (`messageMode`)

- **`ai`**: mensagem **gerada com IA** a partir do briefing/tema (e campos como tom, CTA, audiência) configurados no Disparador.
- **`database`**: mensagens vêm dos **templates** cadastrados na base do Disparador (modo “base”).

## Frontend

- Log «Janela Disparador» acrescenta retorno previsto quando `previsaoRetornoBr` vier preenchido.
- Resumo de config e linha por campanha exibem rótulo explicativo ao lado de `modo ai` / `database`.

## Arquivos

- `src/index.ts`, `index.html`, `dist/index.html` (build)

## Palavras-chave

`disparos/diagnostico`, `findNextDisparosWindowStart`, `modoMensagem`, `messageModeLabel`, expediente
