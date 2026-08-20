# Device Cloud — pairingCode ausente + menu Comunidades

## Sintoma

1. Ao clicar **Adicionar ao Aquecedor**, o WhatsApp abria a aba **Comunidades**.
2. Mensagem: «O sistema não retornou o código de vinculação.»

## Causa

1. Toque em `y=1180` acertava a aba inferior **Comunidades** (navegação cega errada).
2. Backend `runRegistrarQrcode` / job / poll só propagavam `qrCode` (imagem). O `pairingCode` do EVO nunca chegava ao frontend.

## Correção

- Backend: `tryExtractPairingCode`; connect/create aceitam pairing sem imagem; job e poll devolvem `pairingCode`.
- Frontend: poll repassa `pairingCode`.
- Navegação: Perfil → Aparelhos conectados (sem toques na barra Comunidades).

## Marker

`DEPLOY-2026-08-20-device-cloud-pairingcode-fix`

## Validar

1. Redeploy `waba_disparador` (backend + UI).
2. Lingueta → não deve abrir Comunidades.
3. Status deve chegar a «Inserindo código…» (não erro de pairing ausente).

## Keywords

pairingCode, Comunidades, tryExtractPairingCode, device-cloud, registrar-qrcode
