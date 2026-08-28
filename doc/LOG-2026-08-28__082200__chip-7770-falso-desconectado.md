# Chip WB-7770 vermelho falso + «+ Instâncias» sem efeito

## Contexto do pedido

Campanha Corbans em execução: WB-7770 vermelho («desconectado») embora o número não estivesse desconectado nem bloqueado. «+ Instâncias» não incluiu o spare ativo.

## Causa

1. Etiqueta da campanha só ficava verde com `connectionState === "open"`. Probe vazio/timeout ou apelido `WB-7770` (EVO `drax`) pintava vermelho. A aba Instâncias trata probe vazio como número ainda no ar.
2. GET contava spare por apelido; POST exigia live `open`. Spare «existe» na UI e o POST devolve 409 — o botão parece não fazer nada. Com a campanha running, o texto falava em troca automática que também não rodava.

## Solução

- Chip vermelho só com close explícito. Vazio, `connecting`, `pairing`, `qrcode` = conectado na etiqueta.
- Probe de saúde tenta chave EVO, nome gravado e apelido.
- POST «+ Instâncias» enriquece live antes de decidir quem está offline (não troca 7770 se não estiver close).
- Spare live: mesmo critério do chip (vazio não bloqueia inclusão).

## Arquivos

- `src/instances/evo-connection-state.service.ts`
- `src/index.ts`
- `src/deploy-marker.ts` → `DEPLOY-2026-08-28-083300-keep-pairing-chip-live`

## Como validar

Após Redeploy: Corbans — WB-7770 verde se o WhatsApp está no ar. «+ Instâncias» inclui o número livre sem tirar o 7770. Sem `sendText`.

## Palavras-chave

WB-7770, drax, chip vermelho, + Instâncias, connectionState, fetchInstances, spare
