# Validação CONFIRMAR — textos progressivos + instância nova (7943)

**Marker:** `DEPLOY-2026-07-01-validacao-confirmar-progress-ui-empty-inbox`

## Problema

- **5182007943** (`7943`): `findMessages=0`, `findChats=0` — pull-only nunca acha CONFIRMAR (Evolution sem histórico indexado).
- UI ficava estática em «Processando» → ansiedade na espera.

## Diagnóstico 7943

| Item | Valor |
|------|--------|
| Instância | `7943` — `open` |
| findMessages | **0** |
| findChats | **0** |
| Webhook | enabled (não usado na validação pull-only) |

Pull após «Sim» consulta APIs vazias indefinidamente.

## Solução

### UI (`index.html`)

Textos progressivos na fase `verify-receive` (após «Sim, já enviei»):

| Tempo | Texto |
|-------|--------|
| 0s | Buscando a identificação da mensagem enviada |
| 5s | Processando o ID para match da instância |
| 10s | Aguarde até finalizarmos a integração |

### Backend (`instance-inbound-validation.service.ts`)

Após 8 tentativas de pull sem CONFIRMAR: se instância **open** e inbox **vazio** (0 msgs, 0 chats) → `completeValidationForNewEmptyInbox` — libera integração pela conexão QR.

## Alternativa de processo (proposta)

**Validação em 2 níveis (recomendado):**

1. **Nível A (obrigatório):** QR escaneado + `connectionState=open` → instância utilizável.
2. **Nível B (opcional):** CONFIRMAR + resposta automática — só para quem quiser teste completo; botão «Pular validação» já existe.

Isso evita depender de indexação Evolution em instâncias novas ou @lid-heavy.

## Validar

1. `7943` / 5182007943 → passo 3 → Sim → conclui em segundos (empty inbox) ou textos progressivos visíveis.
2. `/health` → marker novo após redeploy.

## Palavras-chave

`5182007943`, `7943`, `empty-inbox`, `progress-ui`, `validacao-conexao`
