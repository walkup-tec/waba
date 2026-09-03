# Push GitHub master — mídia vídeo do assinante

## Contexto do pedido

O usuário pediu push de tudo que estava pendente para subir (GitHub `master` / EasyPanel).

## Ações executadas

- Marker `DEPLOY-2026-09-03-123000-assinante-midia-video`.
- `npm run build` e commit de `dist/`.
- `bash scripts/git-push-github-master.sh HEAD` → `walkup-tec/waba` `master`.
- Sem Redeploy EasyPanel (o usuário faz o deploy).

## Solução publicada

Wizard da campanha: etapa Mídia com Imagem (PNG/JPG 1080×1080) ou Vídeo MP4 (H.264, AAC ou sem áudio, até 16 MB). Regras visíveis antes do arquivo.

## Arquivos

- `src/deploy-marker.ts`
- `dist/deploy-marker.js`
- `docs/project-memory/06-CURRENT_STATUS.md`
- `doc/memoria.md`
- este LOG

## Como validar

No GitHub, `master` deve apontar para o SHA deste push. Depois o usuário faz Redeploy do `waba_disparador`. Conferir Actions **Deploy FTP (bundle)** se o workflow disparar.

Após Redeploy: `GET /health` → `deployMarker` = `DEPLOY-2026-09-03-123000-assinante-midia-video`.

No wizard do assinante: etapa 3. Mídia, escolher Vídeo, ver as regras, recusar MOV e aceitar MP4.

## Segurança

Token só em `$GITHUB_TOKEN`. Sem Redeploy daqui. Após Redeploy, 502 curto no login é o heal v6 (`:30180`).

## Palavras-chave

push-github-master, easypanel, assinante, midia, video, mp4, deploy-marker
