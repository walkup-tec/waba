# LOG — Fix Gerar QRCode instância (mozart)

**Data:** 2026-06-15

## Problema
Modal Registrar instância: clique em **Gerar QRCode** sem feedback (nome com espaços «Marcelo Mozart»).

## Correção (`index.html`)
- Listeners diretos em `#register-qrcode-btn` + `bindRegisterInstanceModalActions()` na abertura do modal
- `z-index` do overlay: 5300
- Normalização do nome → slug (`marcelo-mozart`) antes do POST
- Feedback imediato: status «Gerando QRCode…» + preview loading
- `disabled` no botão durante a requisição

## Validar
Instâncias → Nova instância → nome sem espaços ou com espaços (ajusta) → **Gerar QRCode**.
