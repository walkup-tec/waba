# LOG — Template vídeo: uuid "ai"

## Erro

Modal: `Não foi possível enviar a mídia. Error invalid input syntax for type uuid: "ai"`

## Causa

`POST /templates/:templateId/header-media` estava **antes** de `POST /templates/ai/header-media`. Express capturava `templateId=ai` e o Postgres rejeitava.

## Correção

1. Registrar `/templates/ai/*` antes de `/:templateId`.
2. Validar UUID em `/:templateId`.
3. Repo não consulta id inválido.
4. Erro PG de uuid → `template_not_found` (sem vazar SQL).

Marker: `DEPLOY-2026-09-03-204500-template-ai-header-route`

## Validar

```bash
npm run test:broadcast-header
curl -sS https://waba.draxsistemas.com.br/health | python3 -c 'import json,sys; print(json.load(sys.stdin).get("deployMarker"))'
```

Redeploy EasyPanel do `waba_disparador`. Cloud sem fila (`pending=0`) — seguro.

## Palavras-chave

uuid ai, header-media, template vídeo, route order
