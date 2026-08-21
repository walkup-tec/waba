# LOG — QR: EVO_API_URL era falso positivo

## Contexto
UI mostrou: «Erro ao gerar QRCode… Confira EVO_API_URL…».

## Evidência
- Marker `qrcode-smoke-detail` no ar
- `evoApiBase=http://172.17.0.1:30181` (já correto)
- `GET /service/evo-qr-create-smoke` → **ok:true**, create 201, extractOk, ~5s
- Mensagem = fallback da UI quando `error` é genérico e `detail` não chega no `Error`

## Causa
Não é `EVO_API_URL`. Create/extract no container funciona. Falha no caminho autenticado do wizard; UI descartava `detail` no HTTP !ok.

## Correção
- Anexar `data.detail` no throw do POST
- Fallback sem culpar EVO_API_URL
- Ring buffer + `GET /service/evo-qr-recent-failures`
- claimOnRegister com try/catch (erro de disco explícito)
- Marker: `DEPLOY-2026-07-25-qrcode-failure-trace`

## Validar
1. Redeploy Node
2. Reproduzir QR uma vez
3. Abrir `/service/evo-qr-recent-failures` e ler `items[0]`
4. Smoke continua ok

## Palavras-chave
EVO_API_URL falso positivo, qr-recent-failures, detail UI, smoke ok, wizard auth path
