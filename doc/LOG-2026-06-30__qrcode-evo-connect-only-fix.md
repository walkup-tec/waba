# QRCode — remover rota /instance/qrcode inexistente

**Data:** 2026-06-30

## Erro reportado

```json
{"status":404,"error":"Not Found","response":{"message":["Cannot GET /instance/qrcode/atendimento-6019?number=555182006019"]}}
```

## Causa

Evolution API v2 **não tem** `GET /instance/qrcode/{instance}`. O WABA tentava essa rota por último e exibia o 404 como erro final — mesmo quando `/instance/connect` era a rota correta.

Também: `?number=` em todas as URLs (incluindo qrcode) e logout/restart em paralelo atrapalhavam o connect.

## Correção

- Removida rota `/instance/qrcode/` do fluxo
- Apenas `/instance/connect/{instance}` — GET, POST e POST com `{ number }` no body
- Sem `?number=` na query (número só no body quando informado)
- `tryExtractQrCode` prioriza `response.base64` (formato Evolution v2)
- Normaliza base64 raw para `data:image/png;base64,...`
- 2 rodadas com pausa 2,5s se connect retorna 200 sem imagem ainda
- logout → restart **sequencial** + pausa 1,5s antes do connect
- Erros 404 de `/instance/qrcode` ignorados no resumo

## Validar

Instância `atendimento-6019` → Atualizar QR → imagem ou erro de `/instance/connect` (não qrcode).

## Palavras-chave

`qrcode`, `instance/connect`, `404 qrcode`, `atendimento-6019`
