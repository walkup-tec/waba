# Produção ainda no HTML antigo do Inbox

## Contexto

Operador ligou o Laboratório e viu o switch verde; mandou mensagem teste; Inbox vazio; sem indicação do número.

## Evidência

- `GET /health` em `https://waba.draxsistemas.com.br/health` = `DEPLOY-2026-08-28-101500-pick-7770-drax-1261`
- HTML no ar: `inboxEnabled !== false` e banner `class="muted"` (sem «Números no Inbox»)
- Git `github/master` já tinha `1ba6e01` com `inboxEnabled === true` e o banner do chip
- EasyPanel `waba_disparador` copia `dist/` na imagem; push Git **não** troca o container

## Solução

Marker `DEPLOY-2026-08-28-111300-inbox-opt-in-numero` para o próximo Redeploy ficar visível no `/health`. O código do Inbox já está no Git.

## Como validar

Após Redeploy: `/health` com o marker 111300; hard refresh; switch cinza; banner com o telefone depois de ligar.

## Palavras-chave

inboxEnabled, EasyPanel Redeploy, deployMarker, Números no Inbox
