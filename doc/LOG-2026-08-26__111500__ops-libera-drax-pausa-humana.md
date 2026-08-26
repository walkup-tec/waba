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

1. Workflow `Clear Human Pause (SSH)` faz `docker exec` no container `waba_disparador`, grava backup do lifecycle, seta `drax` para `phase=active` e limpa `restrictedUntil` / `restrictedReason`.
2. Reinicia **somente** o container WABA para recarregar o cache em memória (`let cache` do lifecycle). Evolution e proxy não são tocados.
3. Trigger: `.github/pause-triggers/drax-7770.json` no push em `master`.

## Arquivos

- `.github/workflows/clear-human-pause-ssh.yml`
- `.github/pause-triggers/drax-7770.json`

## Como validar

- Actions → **Clear Human Pause (SSH)** concluído com `phase=active`
- `GET /admin/infra/data-snapshot` → lifecycle `drax.phase=active`
- UI Instâncias: WB-7770 sem rótulo «3 horas pausa humana», status conectado
- Campanha Alternativa volta a poder escolher `drax` (`skipHumanPaused`)

## Observações de segurança

- Sem restart da Evolution, sem `proxy/set`, sem log de chaves
- Restart do WABA pode gerar ~1 min de HTTP 502 no Traefik (mesmo padrão de Redeploy)

## Palavras-chave

`pausa humana`, `restricted_wait`, `drax`, `5181077770`, `WB-7770`, `aquecedor-instance-lifecycle`, `skipHumanPaused`
