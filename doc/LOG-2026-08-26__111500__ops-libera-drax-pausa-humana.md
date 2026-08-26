# LOG — Liberar 5181077770 (drax) da pausa humana

## Contexto do pedido

Tirar o número **5181077770** (instância Evolution `drax`, alias WB-7770) da **Pausa Humana**, mantê-lo **conectado** e **disponível para disparo**. Não desconectar, não recriar, não alterar Proxy Brasil.

## Evidências

- `GET /admin/instances/lookup?phone=5181077770`: `drax`, `connectionStatus=open`
- Alias: `drax` → `WB-7770`
- `aquecedor-instance-lifecycle.json` chave `drax`: `phase=restricted_wait`, `restrictedUntil=2026-08-26T14:40:20.340Z`
- Motivo gravado: outbound MessageUpdate=ERROR no aquecedor (não é `useDisparador` no Supabase neste caminho)
- `whatsapp-connecting-restriction.json`: sem entrada para `drax`
- Chaves irmãs `drax-ofc`, `drax-oficial`, `drax-7770` já estavam `active` (não alterar)
- Este PC não tem SSH root no VPS; a liberação roda via GitHub Actions (`VPS_SSH_PRIVATE_KEY`)

## Solução

1. Workflow SSH tentou gravar o JSON no volume — **falhou** porque `VPS_SSH_PRIVATE_KEY` não está disponível no GitHub Actions (run [#1](https://github.com/walkup-tec/waba/actions/runs/32979902863)).
2. Endpoint `POST /instancias/:name/liberar-pausa-humana` (sessão master): `clearAquecedorHumanPause` + `useDisparador=true` + limpa restrição WhatsApp connecting. Sem proxy/restart Evolution.
3. Marker `DEPLOY-2026-08-26-libera-pausa-humana` — exige Redeploy EasyPanel `waba_disparador` para valer no processo em execução.

## Arquivos

- `.github/workflows/clear-human-pause-ssh.yml`
- `.github/pause-triggers/drax-7770.json`
- `src/services/aquecedor-instance-lifecycle.service.ts` (`clearAquecedorHumanPause`)
- `src/index.ts` (rota)
- `src/deploy-marker.ts` / `dist/*` equivalentes

## Como validar

- Após Redeploy: `GET /health` mostra o marker
- `POST /instancias/drax/liberar-pausa-humana` com cookie master → `phase=active`
- Snapshot: `drax.phase=active`
- UI: WB-7770 conectado, sem «3 horas pausa humana»

## Observações de segurança

- Sem restart da Evolution, sem `proxy/set`, sem log de chaves
- Redeploy do WABA pode gerar ~1 min de HTTP 502 no Traefik

## Palavras-chave

`pausa humana`, `restricted_wait`, `drax`, `5181077770`, `WB-7770`, `aquecedor-instance-lifecycle`, `skipHumanPaused`
