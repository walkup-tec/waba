# LOG — Resume Disparo Cloud órfão + Jandira 2 em 357

## Contexto

Dump VPS do lote `5552c6f7-72e5-40ea-935f-c44c685fa0b4` (Jandira 2, 15:51):

- `status: running`, `voidedAt: null`
- total **1162** (UI 1990 = plannedSendCount do intake)
- sent **357**, failed 0, **delivered 289** (186 delivered + 103 read)
- queued **805**
- erros Meta pontuais: `131026`×48, `131042`×1 — **sem 131053**

O cabeçalho local funcionou. O travamento veio do Redeploy (`serverBootId` ~19:23 UTC): o loop em memória morreu e não retomava.

## Solução

No boot, depois do void de lotes mortos:

1. Fecha `running` sem leads pendentes → `done`/`failed`
2. Retoma `running`/`queued` com leads `queued` — re-resolve template + header local e chama `runCampaign` (pula sent/failed/skipped)
3. Não checa ocupação do número (o próprio lote ocupa)

Marker: `DEPLOY-2026-09-03-193200-broadcast-resume-orphan`

## Validar

```bash
npm run test:broadcast-header
curl -sS https://waba.draxsistemas.com.br/health | python3 -c 'import json,sys; print(json.load(sys.stdin).get("deployMarker"))'
```

Após Redeploy EasyPanel do `waba_disparador`, o contador da Jandira 2 deve voltar a subir a partir de 357. Logs: `broadcast-resume` / `broadcast-boot-resume`.

**Não** voidar `5552c6f7-…` — há 289 entregas e 805 na fila.

## Arquivos

- `meta-whatsapp-broadcast.store.ts` — list/finalize orphan
- `meta-whatsapp-broadcast.service.ts` — resume no boot
- `index.ts` — `ensureResumeOrphanedCloudBroadcasts()`
- `meta-whatsapp-broadcast-resume.test.ts`

## Palavras-chave

jandira 2, 5552c6f7, resume, orphan, 357, 805 queued, redeploy, 131026
