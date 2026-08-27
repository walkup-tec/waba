# Campanha: chip selecionado não fica em pausa humana

## Contexto do pedido

WB-7770 (`drax` / `5181077770`) ficava em pausa humana o tempo todo e não enviava na campanha, apesar de `open` e Proxy ligada.

## Causa

1. Motor Alternativa chamava `pickDisparadorInstanceForConfig` com `skipHumanPaused: true`: `restricted_wait` sai do pool (sessão pode continuar verde).
2. Falha de `sendText` da campanha marcava restrição com `{ force: true }` (3h), reaplicando a pausa.
3. Aquecedor / probe de integração também podiam repor `restricted_wait` e `useDisparador: false` no mesmo chip.

Evidência: EVO `drax` com `connectionState=open`, proxy on, `_count.Message` parado em 11 enquanto 5401/9224/2477 subiam.

## Solução

- Campanha **não ignora** chip selecionado por pausa humana.
- Falha de envio da campanha **não** aplica pausa humana.
- Chip em campanha `running`/`paused`: aquecedor/probe **não** aplicam pausa nem desligam Disparador.
- Tick da campanha libera `restricted_wait` e religa Disparador nos selecionados.

## Arquivos

- `src/index.ts`
- `src/deploy-marker.ts` → `DEPLOY-2026-08-27-campanha-sem-pausa-humana-no-chip`
- `dist/index.js`, `dist/deploy-marker.js`

## Como validar

- Após Redeploy EasyPanel `waba_disparador`: `GET /health` com o marker acima
- WB-7770 permanece `open` na campanha e o volume EVO de `drax` sobe (não só 5401/9224)
- Sem `sendText` de diagnóstico

## Segurança

Sem log de tokens. Sem probe WhatsApp extra.

## Palavras-chave

campanha, pausa humana, restricted_wait, 7770, drax, skipHumanPaused, Alternativa
