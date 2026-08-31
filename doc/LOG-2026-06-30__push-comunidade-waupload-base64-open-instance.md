# Push comunidade — fix waUploadToServer + instância aberta

**Data:** 2026-06-30

## Problema

```
HTTP 500: Cannot read properties of undefined (reading 'waUploadToServer')
```

Push parcial: e-mail OK, comunidade falha na imagem. Funcionava com instância `walkup`; após migração para Drax parou.

## Causa raiz (análise agents + código)

1. **sendMedia tentava URL antes de base64** — Evolution faz Axios para `http://172.17.0.1:30180/...` ou HTTPS; falha de rede → buffer `undefined` → `waUploadToServer` explode
2. **Instância configurada desconectada** — `resolvePushCommunityEvoInstance` retornava match exato por nome sem checar `connectionStatus: open`
3. **`caption: undefined`** omitido do JSON — incompatível com Evolution v2
4. **Fallback `walkup` removido** da lista de instâncias candidatas

## Correções

| Área | Mudança |
|------|---------|
| Mídia | **Base64 data-URI primeiro** (até ~1 MB); URL só fallback |
| Payload | `caption: ""` sempre string; `data:image/jpeg;base64,...` |
| Instância | Prefere instância **conectada** no catálogo Evolution |
| Ranking | Só instâncias `open` no pool de mídia; `walkup` de volta como último fallback |
| Default | `drax-oficial` (nome real na Evolution) |
| Imagem | Reutiliza instância que enviou texto com sucesso |

## Arquivos

- `src/push/waba-push-community.service.ts`
- `src/push/waba-push.types.ts`
- `src/deploy-marker.ts`

## Validar

1. Push com imagem + comunidade → imagem no grupo WhatsApp
2. Se imagem falhar mas texto OK → status Enviado (não parcial assustador)
3. Logs: `[push] sendMedia` não deve ser primeira tentativa com URL se base64 couber

## Easypanel (recomendado)

```env
WABA_PUSH_COMMUNITY_EVO_INSTANCE=drax-oficial
WABA_PUSH_COMMUNITY_ANNOUNCEMENT_GROUP_JID=120363427861535827@g.us
```

Reconectar instância na Evolution se continuar `Connection Closed`.

## Palavras-chave

`waUploadToServer`, `sendMedia`, `base64-first`, `open-instance`, `drax-oficial`, `walkup-fallback`
