# LOG — V02 Atualizar QRCode não gera imagem

**Data:** 2026-06-20  
**Sintoma:** Modal «Conectar instância WhatsApp» passo 2 fica em «Gerando novo QRCode de conexão...» sem exibir QR.

## Causa raiz
1. **Frontend** `refreshQrCodeInRegisterModal` usava `POST /instancias/:name/qrcode` com timeout **12s** — Evolution demora até ~45s+ com retries.
2. Endpoint `/qrcode` no backend tentava **uma única URL** EVO com **1 retry** (enquanto `registrar-qrcode` usava várias URLs + 3 retries).
3. Em erro/timeout, o modal **não atualizava** o preview — ficava eternamente em «Gerando...».

## Correção
- **Backend** `fetchInstanceQrCodeFromEvo()`: múltiplas rotas (`connect`, `qrcode`, `qr`, POST connect) + 3 retries + timeout 45s.
- **`POST /instancias/:name/qrcode`** e **`registrar-qrcode`** usam o helper compartilhado.
- **Frontend** «Atualizar QR» chama **`/instancias/registrar-qrcode`** (create 409 OK + connect robusto), timeout **90s**, mensagem de erro no preview.

## Validação
- Build OK; reiniciar V02 (`npm run dev:v02`).
- Ctrl+F5 → abrir instância desconectada → Atualizar QR → aguardar até 90s ou mensagem clara de falha EVO.

## Pendências
- Se EVO remota offline (`ETIMEDOUT`), QR não aparece — mensagem de erro deve surgir após timeout, não loading infinito.
