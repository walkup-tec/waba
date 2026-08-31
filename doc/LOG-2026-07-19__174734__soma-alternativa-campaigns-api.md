# API Soma → campanha API Alternativa

**Data:** 2026-07-19  
**Contexto:** Funil de prospecção do Soma CRM precisa criar campanha no WABA (owner mozart).

## Endpoint

`POST /integrations/soma/alternativa-campaigns`

- Auth: header `X-Soma-Waba-Key` = `SOMA_WABA_INTEGRATION_KEY`
- Owner: `SOMA_WABA_OWNER_EMAIL` (default `mozart.pmo@gmail.com`)
- Cria campanha **paused** com `configSnapshot` (IA/fixo, delays, janela, instâncias, link resposta)
- `numbers[]` opcional; sem leads ainda a mensagem indica sync na execução do funil
- Bypass auth cookie em `waba-auth.routes.ts` (mesmo padrão do aquecedor)

## Arquivos

- `src/index.ts`
- `src/auth/waba-auth.routes.ts`

## Env

- `SOMA_WABA_INTEGRATION_KEY` (obrigatório nos dois lados)
- `SOMA_WABA_OWNER_EMAIL` (opcional)

## Doc upstream

Fluxo interno de disparos Alternativa (parseDisparosConfig / assertAlternativaDispatchReady) — não é Traefik.

## Palavras-chave

`soma-alternativa-campaigns`, `SOMA_WABA_INTEGRATION_KEY`, `funil-prospeccao`
