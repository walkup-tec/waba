# QRCode integração — geração assíncrona + alinhamento modal

**Data:** 2026-06-30

## Problemas

1. Modal «Conectar instância WhatsApp» não gerava QR — mensagem *"Conexão interrompida durante a geração do QRCode"*
2. Conteúdo do wizard centralizado; usuário pediu **texto à esquerda**, gráficos e botões centralizados

## Causa raiz QR

- `POST /instancias/registrar-qrcode` era **síncrono** e podia levar 60–120s+ (create + logout/restart + várias rotas EVO)
- Proxy/browser cortava a conexão → `Failed to fetch` no frontend
- `prepareSession` (logout+restart) rodava mesmo em instância recém-criada, atrasando desnecessariamente

## Correções

### Backend
- Geração em **job assíncrono**: POST retorna **202** + `jobId`; `GET /instancias/registrar-qrcode/jobs/:jobId` para poll
- `runRegistrarQrcode()` extraído; `prepareSession` só se instância já existia ou create falhou
- Connect EVO: **POST** antes de GET; timeout QR até 60s+; logout/restart em paralelo
- Jobs expiram em 15 min

### Frontend
- `submitAndPollRegistrarQrcode()` + `pollRegistrarQrcodeJob()` com retentativas de rede
- Removida mensagem genérica de "conexão interrompida"; exibe erro real da Evolution
- Deploy resilience não dispara em `/instancias/*`

### UI modal wizard
- Títulos, leads, instruções, status, erros → **text-align: left**
- Stepper (gráfico) e botões do footer → **centralizados**
- Imagem QR e ícone de sucesso → **centralizados**

## Validar

1. Instâncias → conectar nova → Gerar QR / Atualizar QR
2. Deve mostrar loading e QR em até ~90s ou erro EVO explícito
3. Textos do modal alinhados à esquerda; QR e botões centralizados

## Palavras-chave

`qrcode`, `registrar-qrcode`, `async-job`, `register-wizard-modal`, `text-align-left`
