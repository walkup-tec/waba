# Deploy

## Ambientes

| Ambiente | URL / Host | Observações |
|----------|------------|-------------|
| Produção | https://waba.draxsistemas.com.br/ | Único publicado; branch `master` |
| V02 local | localhost | Não publicar |
| V03 local | localhost | Não publicar |

## Processo de deploy (produção)

1. Implementar em `src/` e/ou `index.html`.
2. **Obrigatório:** `npm run build` (gera/atualiza `dist/`, inclusive `dist/index.html` e `dist/deploy-marker.js`).
3. Commit em `master` incluindo o `dist/` necessário.
4. Push `origin master`.
5. Redeploy EasyPanel do serviço `waba_disparador`.
6. Validar `GET /health` (deploy marker) e hard refresh no browser.

## FTP vs EasyPanel (UI principal)

| Canal | O que atualiza | Não atualiza |
|-------|----------------|--------------|
| GitHub Actions **Deploy FTP (bundle)** | Bundle FTP / artefatos do workflow | Container Easypanel `waba_disparador` |
| Push `master` + **Redeploy EasyPanel** | Imagem Docker que serve `https://waba.draxsistemas.com.br/` | — |

A URL de login/disparador usa o container Docker (`COPY dist/`). Mudança só em `index.html` na raiz sem `npm run build` + commit de `dist/` **não** reflete em produção — mesmo com push em `master`.

## Docker / EasyPanel

- Serviço: `waba_disparador`.
- Dockerfile: `COPY dist ./dist` — **não** roda `npm run build` na imagem.
- Consequência: mudança só na raiz/`src/` **não** aparece em produção sem `dist/` commitado.
- Comentário no Dockerfile: rodar build e commitar `dist/` antes do push.
- Incidente recorrente: `index.html` (raiz) atualizado, `dist/index.html` desatualizado → UI antiga em produção (LOG `doc/LOG-2026-08-19__140200__device-cloud-dist-index-desatualizado-fix.md`).

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
| `DEPLOY-2026-08-31-153000-campanha-slot-swap-proxy` | Campanha: teto de slots, troca 1:1, Proxy no spare |
| `DEPLOY-2026-08-31-114800-campanha-proxy-obrigatoria` | Campanha: só dispara com Proxy Brasil ligada |
| `DEPLOY-2026-08-28-121400-inbox-envio-conversa` | Inbox: envio Cloud na conversa + resposta pelo compositor |
| `DEPLOY-2026-08-28-111300-inbox-opt-in-numero` | Inbox: switch cinza, banner do número, webhook ao ligar |
| `DEPLOY-2026-08-28-110000-swap-bloqueado-2102` | Campanha: chip bloqueado WhatsApp (403) + spare 2102 |
| `DEPLOY-2026-08-28-101500-pick-7770-drax-1261` | Campanha: pick 7770→drax e 1261 na lista |
| `DEPLOY-2026-08-28-090000-botao-append-spare` | «+ Instâncias» inclui o spare da UI (append, sem 409 compra) |
| `DEPLOY-2026-08-24-alternativa-sem-asteriscos-titulo` | Alternativa: sendButtons sem `**` (title real) |
| `DEPLOY-2026-08-21-campanha-auto-swap-instancias` | Campanha: troca automática de desconectado + Proxy |
| `DEPLOY-2026-08-21-alternativa-keep-pairing` | Alternativa: não desligar proxy/restart com campanha viva |
| `DEPLOY-2026-08-20-alternativa-image-then-text` | Alternativa: após imagem, texto visível (viewOnce não bloqueia) |
| `DEPLOY-2026-08-20-alternativa-no-proxy-mid-send` | Alternativa: sem proxy/set/restart no meio do disparo |
| `DEPLOY-2026-08-20-alternativa-button-restore` | Alternativa: restaurar sendButtons do 11/08 (title real) |
| `DEPLOY-2026-08-20-alternativa-url-button` | Alternativa: sendButtons sem URL/preview no texto |
| `DEPLOY-2026-08-20-warmth-chip-lookup` | Foguinhos Quente por chip (soma-9224) |
| `DEPLOY-2026-08-19-device-cloud-lingueta-tab` | Dispositivos: lingueta Aquecedor, sem Aquecer/Início |
| `DEPLOY-2026-08-19-125000-welcome-cover-sendmedia` | Boas-vindas: capa JPEG via sendMedia |
| `DEPLOY-2026-08-19-080900-welcome-must-arrive` | Boas-vindas obrigatória: fila + JID canônico |
| `DEPLOY-2026-08-03-aquecedor-delivery-ack-lid` | Aquecedor: confirmação via DELIVERY_ACK / anti-`@lid` |
| `DEPLOY-2026-08-03-excluir-owners-metricas-split` | Excluir owners internos de métricas/split |

## Rollback

Reverter commit em `master` (incluindo `dist/`) e Redeploy EasyPanel; ou restaurar imagem/tag anterior no painel.
