# LOG — Restrição: connecting EVO ≠ ban (falso positivo 6973)

## Contexto

Sistema marcava **5181076973** (instância `6973`) como **Restrição**. Usuário confirmou que **não** há restrição WhatsApp.

## Causa

EVO: `connectionState/6973` = `connecting`. O produto tratava **qualquer** `connecting` como restrição de 3h (store + fallback UI). Em reconnect/QR/`device_removed`, `connecting` é normal — não é ban.

## Solução

1. Parar de criar tag a partir de `connecting`.
2. Purge no boot de tags automáticas legadas (`connecting-auto`).
3. UI: remover fallback `live === connecting → Restrição`.
4. Tag **Restrição** só com origem `explicit` (API `markWhatsappRestrictionExplicit` para uso futuro com evidência real).

Marker: `DEPLOY-2026-07-23-restricao-nao-por-connecting`

## Arquivos

- `src/instances/whatsapp-connecting-restriction.service.ts` (+ dist)
- `src/index.ts` / `dist/index.js`
- `index.html` / `dist/index.html`
- `src/deploy-marker.ts`

## Validar

1. Redeploy Node + FTP HTML.
2. `/health` com marker novo.
3. `6973` / 5181076973: status **desconectado** (ou Preparando), **não** Restrição; card Restrição Temporária sem contar esse número só por connecting.

## Palavras-chave

6973, 5181076973, falso positivo, connecting, restrição, purgeAutomatic
