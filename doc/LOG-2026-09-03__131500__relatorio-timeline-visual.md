# LOG — Linha do tempo visual no relatório do assinante

## Contexto

A linha do tempo do relatório era uma lista texto (rótulo + data). O pedido foi deixá-la mais agradável, com pontos que mostrem a evolução.

## Solução

- Desktop (≥ 860 px): trilha **horizontal** com pontos ligados por uma linha.
- Mobile: a mesma trilha na **vertical**, com o fio à esquerda.
- Só entram marcos que já têm horário (sem "—").
- Data compacta no ponto; data completa no `title` e para leitor de tela.
- O último marco ganha destaque (ponto atual).
- O aviso da Meta (até 3 horas) continua abaixo.

## Arquivos

- `index.html` (CSS + `buildSubscriberCampaignTimelineHtml`)
- `dist/index.html` (cópia do build)
- `doc/memoria.md`
- este LOG

## Como validar

Abrir o relatório de uma campanha do assinante com disparo concluído. Conferir 5 pontos na horizontal no desktop e a coluna de pontos no celular. Sem timestamps, a seção some e só o aviso da Meta permanece.

## Segurança

Sem mudança de API, credenciais ou regras de cálculo do relatório.

## Palavras-chave

timeline, linha do tempo, relatório assinante, stepper, pontos
