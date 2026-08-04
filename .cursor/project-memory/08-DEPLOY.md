# Deploy

## Ambientes

| Ambiente | URL / Host | Observações |
|----------|------------|-------------|
| Produção | https://waba.draxsistemas.com.br/ | Único publicado; branch `master` |
| V02 local | localhost | Não publicar |
| V03 local | localhost | Não publicar |

## Processo de deploy (produção)

1. Implementar em `src/` e/ou `index.html`.
2. **Obrigatório:** `npm run build` (gera/atualiza `dist/`, inclusive `dist/index.html`).
3. Commit em `master` incluindo o `dist/` necessário.
4. Push `origin master`.
5. Redeploy EasyPanel do serviço `waba_disparador`.
6. Validar `GET /health` (deploy marker) e hard refresh no browser.

## Docker / EasyPanel

- Serviço: `waba_disparador`.
- Dockerfile: `COPY dist ./dist` — **não** roda `npm run build` na imagem.
- Consequência: mudança só na raiz/`src/` **não** aparece em produção sem `dist/` commitado.
- Comentário no Dockerfile: rodar build e commitar `dist/` antes do push.

## Variáveis importantes

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| Ver `.env.example` / `.env.v01.example` / `.env.v02.example` | Config por ambiente | Sim (conforme ambiente) |
| `EVO_API_URL` / `EVO_API_KEY` | Evolution | Sim para WhatsApp outbound |

## Checklist de deploy

- [ ] `npm run build` executado
- [ ] `dist/index.html` (e JS afetados) no commit
- [ ] Push em `master` (não em branch só local)
- [ ] Redeploy EasyPanel
- [ ] `/health` com marker esperado
- [ ] Hard refresh (Ctrl+F5) na UI

## Markers recentes

| Marker | Tema |
|--------|------|
| `DEPLOY-2026-08-03-aquecedor-delivery-ack-lid` | Aquecedor: confirmação via DELIVERY_ACK / anti-`@lid` |
| `DEPLOY-2026-08-03-excluir-owners-metricas-split` | Excluir owners internos de métricas/split |
| `DEPLOY-2026-08-02-atribuir-campanha-operacional` | Atribuir campanha a operacional |
| `DEPLOY-2026-07-30-resend-welcome-sem-senha` | Reenvio boas-vindas sem senha |

## Rollback

Reverter commit em `master` (incluindo `dist/`) e Redeploy EasyPanel; ou restaurar imagem/tag anterior no painel.
